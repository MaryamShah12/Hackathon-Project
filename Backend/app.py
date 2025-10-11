from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
import psycopg2
import bcrypt
import os

app = Flask(__name__, static_folder='.')
CORS(app)

# Hardcoded DB credentials (for trial only)
DB_HOST = "...."
DB_PORT = "5432"
DB_NAME = "harvesthub"
DB_USER = "HarvestHub"
DB_PASSWORD = "0000"

def get_db_connection():
    try:
        conn = psycopg2.connect(
            host=DB_HOST,
            port=DB_PORT,
            database=DB_NAME,
            user=DB_USER,
            password=DB_PASSWORD
        )
        return conn
    except Exception as e:
        print(f"Connection error: {e}")
        return None

def init_db():
    conn = get_db_connection()
    if conn is None:
        print("Failed to connect to DB for initialization")
        return
    try:
        cur = conn.cursor()
        # Create users table
        cur.execute("""
            CREATE TABLE IF NOT EXISTS users (
                username VARCHAR(100) PRIMARY KEY,
                password VARCHAR(100) NOT NULL,
                role VARCHAR(50) NOT NULL
            );
        """)
        # Create listings table
        cur.execute("""
            CREATE TABLE IF NOT EXISTS listings (
                id SERIAL PRIMARY KEY,
                title VARCHAR(100) NOT NULL,
                quantity VARCHAR(50) NOT NULL,
                type VARCHAR(50) NOT NULL,
                farmer_id VARCHAR(100) NOT NULL,
                farmer_name VARCHAR(100) NOT NULL,
                available_date DATE,
                price DECIMAL(10,2)
            );
        """)
        # Add status and claimed_by columns if they don't exist
        cur.execute("""
            DO $$ 
            BEGIN
                IF NOT EXISTS (
                    SELECT FROM pg_attribute 
                    WHERE attrelid = 'listings'::regclass 
                    AND attname = 'status'
                ) THEN
                    ALTER TABLE listings 
                    ADD COLUMN status VARCHAR(50) DEFAULT 'available';
                END IF;
                IF NOT EXISTS (
                    SELECT FROM pg_attribute 
                    WHERE attrelid = 'listings'::regclass 
                    AND attname = 'claimed_by'
                ) THEN
                    ALTER TABLE listings 
                    ADD COLUMN claimed_by VARCHAR(100);
                END IF;
            END $$;
        """)
        # Create ngo_profiles table
        cur.execute("""
            CREATE TABLE IF NOT EXISTS ngo_profiles (
                ngo_id VARCHAR(100) PRIMARY KEY,
                org_name VARCHAR(200) NOT NULL,
                contact VARCHAR(100) NOT NULL,
                address TEXT NOT NULL,
                focus_area TEXT NOT NULL
            );
        """)
        # Create purchase_requests table
        cur.execute("""
            CREATE TABLE IF NOT EXISTS purchase_requests (
                id SERIAL PRIMARY KEY,
                listing_id INTEGER NOT NULL,
                buyer_id VARCHAR(100) NOT NULL,
                farmer_id VARCHAR(100) NOT NULL,
                crop_title VARCHAR(100) NOT NULL,
                quantity VARCHAR(50) NOT NULL,
                price DECIMAL(10,2),
                payment_proof TEXT,
                status VARCHAR(50) DEFAULT 'pending',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        """)
        conn.commit()
        cur.close()
        print("Tables created or updated successfully")
    except Exception as e:
        print(f"Error creating or updating tables: {e}")
    finally:
        conn.close()

# Serve static files (HTML, CSS, JS)
@app.route('/<path:path>')
def serve_static(path):
    return send_from_directory('.', path)

@app.route('/')
def home():
    return send_from_directory('.', 'index.html')

# Register user
@app.route('/api/register', methods=['POST'])
def register():
    data = request.get_json()
    username = data.get('username')
    password = data.get('password')
    role = data.get('role')

    if not all([username, password, role]):
        return jsonify({'error': 'Missing fields'}), 400

    hashed_password = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

    conn = get_db_connection()
    if conn is None:
        return jsonify({'error': 'DB connection failed'}), 500
    try:
        cur = conn.cursor()
        cur.execute("SELECT username FROM users WHERE username = %s;", (username,))
        if cur.fetchone():
            cur.close()
            return jsonify({'error': 'Username already exists'}), 400

        cur.execute(
            "INSERT INTO users (username, password, role) VALUES (%s, %s, %s);",
            (username, hashed_password, role)
        )
        conn.commit()
        cur.close()
        return jsonify({'message': 'Registration successful'}), 201
    except Exception as e:
        print(f"Error registering user: {e}")
        return jsonify({'error': 'Failed to register'}), 500
    finally:
        conn.close()

# Login user
@app.route('/api/login', methods=['POST'])
def login():
    data = request.get_json()
    username = data.get('username')
    password = data.get('password')

    if not all([username, password]):
        return jsonify({'error': 'Missing fields'}), 400

    conn = get_db_connection()
    if conn is None:
        return jsonify({'error': 'DB connection failed'}), 500
    try:
        cur = conn.cursor()
        cur.execute("SELECT username, password, role FROM users WHERE username = %s;", (username,))
        user = cur.fetchone()
        cur.close()
        if user and bcrypt.checkpw(password.encode('utf-8'), user[1].encode('utf-8')):
            return jsonify({
                'username': user[0],
                'role': user[2],
                'message': 'Login successful'
            }), 200
        else:
            return jsonify({'error': 'Invalid username or password'}), 401
    except Exception as e:
        print(f"Error logging in: {e}")
        return jsonify({'error': 'Failed to login'}), 500
    finally:
        conn.close()

# Add listing
@app.route('/api/listings', methods=['POST'])
def add_listing():
    data = request.get_json()
    title = data.get('title')
    quantity = data.get('quantity')
    type_ = data.get('type')
    farmer_id = data.get('farmer_id')
    farmer_name = data.get('farmer_name')
    available_date = data.get('available_date')
    price = data.get('price')

    if not all([title, quantity, type_, farmer_id, farmer_name]):
        return jsonify({'error': 'Missing required fields'}), 400

    conn = get_db_connection()
    if conn is None:
        return jsonify({'error': 'DB connection failed'}), 500
    try:
        cur = conn.cursor()
        cur.execute("""
            INSERT INTO listings (title, quantity, type, farmer_id, farmer_name, available_date, price, status)
            VALUES (%s, %s, %s, %s, %s, %s, %s, 'available') RETURNING id;
        """, (title, quantity, type_, farmer_id, farmer_name, available_date, price))
        listing_id = cur.fetchone()[0]
        conn.commit()
        cur.close()
        return jsonify({'id': listing_id, 'message': 'Listing added'}), 201
    except Exception as e:
        print(f"Error adding listing: {e}")
        return jsonify({'error': 'Failed to add listing'}), 500
    finally:
        conn.close()

# Update listing
@app.route('/api/listings/<int:id>', methods=['PUT'])
def update_listing(id):
    data = request.get_json()
    title = data.get('title')
    quantity = data.get('quantity')
    type_ = data.get('type')
    farmer_id = data.get('farmer_id')
    farmer_name = data.get('farmer_name')
    available_date = data.get('available_date')
    price = data.get('price')

    if not all([title, quantity, type_, farmer_id, farmer_name]):
        return jsonify({'error': 'Missing required fields'}), 400

    conn = get_db_connection()
    if conn is None:
        return jsonify({'error': 'DB connection failed'}), 500
    try:
        cur = conn.cursor()
        cur.execute("""
            UPDATE listings
            SET title = %s, quantity = %s, type = %s, farmer_id = %s, farmer_name = %s, available_date = %s, price = %s
            WHERE id = %s AND status = 'available' RETURNING id;
        """, (title, quantity, type_, farmer_id, farmer_name, available_date, price, id))
        updated_id = cur.fetchone()
        conn.commit()
        cur.close()
        if updated_id:
            return jsonify({'message': 'Listing updated'}), 200
        else:
            return jsonify({'error': 'Listing not found or already claimed'}), 404
    except Exception as e:
        print(f"Error updating listing: {e}")
        return jsonify({'error': 'Failed to update listing'}), 500
    finally:
        conn.close()

# Get all listings
@app.route('/api/listings', methods=['GET'])
def get_listings():
    conn = get_db_connection()
    if conn is None:
        return jsonify({'error': 'DB connection failed'}), 500
    try:
        cur = conn.cursor()
        cur.execute("SELECT id, title, quantity, type, farmer_id, farmer_name, available_date, price, status, claimed_by FROM listings;")
        listings = cur.fetchall()
        cur.close()
        return jsonify([{
            'id': row[0],
            'title': row[1],
            'quantity': row[2],
            'type': row[3],
            'farmer_id': row[4],
            'farmer_name': row[5],
            'available_date': row[6].isoformat() if row[6] else None,
            'price': float(row[7]) if row[7] is not None else None,
            'status': row[8],
            'claimed_by': row[9]
        } for row in listings]), 200
    except Exception as e:
        print(f"Error fetching listings: {e}")
        return jsonify({'error': 'Failed to fetch listings'}), 500
    finally:
        conn.close()

# Delete listing
@app.route('/api/listings/<int:id>', methods=['DELETE'])
def delete_listing(id):
    conn = get_db_connection()
    if conn is None:
        return jsonify({'error': 'DB connection failed'}), 500
    try:
        cur = conn.cursor()
        cur.execute("DELETE FROM listings WHERE id = %s RETURNING id;", (id,))
        deleted_id = cur.fetchone()
        conn.commit()
        cur.close()
        if deleted_id:
            return jsonify({'message': 'Listing deleted'}), 200
        else:
            return jsonify({'error': 'Listing not found'}), 404
    except Exception as e:
        print(f"Error deleting listing: {e}")
        return jsonify({'error': 'Failed to delete listing'}), 500
    finally:
        conn.close()

# Claim donation
@app.route('/api/claim/<int:id>', methods=['POST'])
def claim_donation(id):
    data = request.get_json()
    claimed_by = data.get('claimed_by')

    if not claimed_by:
        return jsonify({'error': 'Missing claimed_by'}), 400

    conn = get_db_connection()
    if conn is None:
        return jsonify({'error': 'DB connection failed'}), 500
    try:
        cur = conn.cursor()
        cur.execute("""
            UPDATE listings
            SET status = 'claimed', claimed_by = %s
            WHERE id = %s AND type = 'donate' AND status = 'available' RETURNING id;
        """, (claimed_by, id))
        claimed_id = cur.fetchone()
        conn.commit()
        cur.close()
        if claimed_id:
            return jsonify({'message': 'Donation claimed'}), 200
        else:
            return jsonify({'error': 'Listing not found, not a donation, or already claimed'}), 404
    except Exception as e:
        print(f"Error claiming donation: {e}")
        return jsonify({'error': 'Failed to claim donation'}), 500
    finally:
        conn.close()

# Get NGO profile
@app.route('/api/ngo/profile', methods=['GET'])
def get_ngo_profile():
    ngo_id = request.args.get('ngo_id')
    if not ngo_id:
        return jsonify({'error': 'Missing ngo_id'}), 400

    conn = get_db_connection()
    if conn is None:
        return jsonify({'error': 'DB connection failed'}), 500
    try:
        cur = conn.cursor()
        cur.execute("SELECT org_name, contact, address, focus_area FROM ngo_profiles WHERE ngo_id = %s;", (ngo_id,))
        profile = cur.fetchone()
        cur.close()
        if profile:
            return jsonify({
                'org_name': profile[0],
                'contact': profile[1],
                'address': profile[2],
                'focus_area': profile[3]
            }), 200
        else:
            return jsonify({'message': 'No profile found'}), 404
    except Exception as e:
        print(f"Error fetching NGO profile: {e}")
        return jsonify({'error': 'Failed to fetch profile'}), 500
    finally:
        conn.close()

# Create/Update NGO profile
@app.route('/api/ngo/profile', methods=['POST'])
def update_ngo_profile():
    data = request.get_json()
    ngo_id = data.get('ngo_id')
    org_name = data.get('org_name')
    contact = data.get('contact')
    address = data.get('address')
    focus_area = data.get('focus_area')

    if not all([ngo_id, org_name, contact, address, focus_area]):
        return jsonify({'error': 'Missing fields'}), 400

    conn = get_db_connection()
    if conn is None:
        return jsonify({'error': 'DB connection failed'}), 500
    try:
        cur = conn.cursor()
        cur.execute("""
            INSERT INTO ngo_profiles (ngo_id, org_name, contact, address, focus_area)
            VALUES (%s, %s, %s, %s, %s)
            ON CONFLICT (ngo_id) DO UPDATE
            SET org_name = %s, contact = %s, address = %s, focus_area = %s;
        """, (ngo_id, org_name, contact, address, focus_area, org_name, contact, address, focus_area))
        conn.commit()
        cur.close()
        return jsonify({'message': 'Profile updated'}), 200
    except Exception as e:
        print(f"Error updating NGO profile: {e}")
        return jsonify({'error': 'Failed to update profile'}), 500
    finally:
        conn.close()

# Analytics endpoints
@app.route('/api/analytics/farmer/<farmer_id>', methods=['GET'])
def get_farmer_analytics(farmer_id):
    conn = get_db_connection()
    if conn is None:
        return jsonify({'error': 'DB connection failed'}), 500
    try:
        cur = conn.cursor()
        cur.execute("""
            SELECT type, quantity, price, status, available_date 
            FROM listings 
            WHERE farmer_id = %s;
        """, (farmer_id,))
        listings = cur.fetchall()
        cur.close()
        
        total_quantity = 0
        total_earnings = 0
        sell_count = 0
        barter_count = 0
        donate_count = 0
        monthly_data = {}
        
        for listing in listings:
            type_, qty_str, price, status, date = listing
            try:
                qty = float(qty_str.split()[0])
            except:
                qty = 0
            
            total_quantity += qty
            
            if type_ == 'sell' and price:
                total_earnings += float(price) * qty
                sell_count += 1
            elif type_ == 'barter':
                barter_count += 1
            elif type_ == 'donate':
                donate_count += 1
            
            if date:
                month_key = date.strftime('%Y-%m')
                if month_key not in monthly_data:
                    monthly_data[month_key] = {'quantity': 0, 'earnings': 0}
                monthly_data[month_key]['quantity'] += qty
                if type_ == 'sell' and price:
                    monthly_data[month_key]['earnings'] += float(price) * qty
        
        return jsonify({
            'total_quantity': total_quantity,
            'total_earnings': total_earnings,
            'sell_count': sell_count,
            'barter_count': barter_count,
            'donate_count': donate_count,
            'monthly_data': monthly_data
        }), 200
    except Exception as e:
        print(f"Error fetching farmer analytics: {e}")
        return jsonify({'error': 'Failed to fetch analytics'}), 500
    finally:
        conn.close()

@app.route('/api/analytics/buyer/<buyer_id>', methods=['GET'])
def get_buyer_analytics(buyer_id):
    conn = get_db_connection()
    if conn is None:
        return jsonify({'error': 'DB connection failed'}), 500
    try:
        cur = conn.cursor()
        cur.execute("""
            SELECT title, quantity, price, type 
            FROM listings 
            WHERE type IN ('sell', 'barter') AND status = 'available';
        """)
        listings = cur.fetchall()
        cur.close()
        
        total_listings = len(listings)
        avg_savings = 0
        crop_types = {}
        
        for listing in listings:
            title, qty_str, price, type_ = listing
            if type_ == 'sell' and price:
                retail_price = float(price) * 1.5
                savings = retail_price - float(price)
                avg_savings += savings
                
                crop_types[title] = crop_types.get(title, 0) + 1
        
        return jsonify({
            'total_listings': total_listings,
            'avg_savings_per_item': avg_savings / max(total_listings, 1),
            'crop_types': crop_types
        }), 200
    except Exception as e:
        print(f"Error fetching buyer analytics: {e}")
        return jsonify({'error': 'Failed to fetch analytics'}), 500
    finally:
        conn.close()

@app.route('/api/analytics/ngo/<ngo_id>', methods=['GET'])
def get_ngo_analytics(ngo_id):
    conn = get_db_connection()
    if conn is None:
        return jsonify({'error': 'DB connection failed'}), 500
    try:
        cur = conn.cursor()
        cur.execute("""
            SELECT title, quantity, available_date 
            FROM listings 
            WHERE type = 'donate' AND claimed_by = %s;
        """, (ngo_id,))
        claimed = cur.fetchall()
        
        cur.execute("""
            SELECT title, quantity 
            FROM listings 
            WHERE type = 'donate' AND status = 'available';
        """)
        available = cur.fetchall()
        cur.close()
        
        total_claimed_qty = 0
        monthly_claims = {}
        crop_types = {}
        
        for donation in claimed:
            title, qty_str, date = donation
            try:
                qty = float(qty_str.split()[0])
            except:
                qty = 0
            
            total_claimed_qty += qty
            crop_types[title] = crop_types.get(title, 0) + 1
            
            if date:
                month_key = date.strftime('%Y-%m')
                monthly_claims[month_key] = monthly_claims.get(month_key, 0) + qty
        
        return jsonify({
            'total_claimed_quantity': total_claimed_qty,
            'claimed_count': len(claimed),
            'available_count': len(available),
            'monthly_claims': monthly_claims,
            'crop_types': crop_types
        }), 200
    except Exception as e:
        print(f"Error fetching NGO analytics: {e}")
        return jsonify({'error': 'Failed to fetch analytics'}), 500
    finally:
        conn.close()

@app.route('/test_db')
def test_db():
    conn = get_db_connection()
    if conn:
        conn.close()
        return 'DB Connection Successful!'
    else:
        return 'DB Connection Failed!'
    




# Create purchase request
@app.route('/api/purchase-request', methods=['POST'])
def create_purchase_request():
    data = request.get_json()
    listing_id = data.get('listing_id')
    buyer_id = data.get('buyer_id')
    payment_proof = data.get('payment_proof')  # base64 encoded image

    if not all([listing_id, buyer_id, payment_proof]):
        return jsonify({'error': 'Missing required fields'}), 400

    conn = get_db_connection()
    if conn is None:
        return jsonify({'error': 'DB connection failed'}), 500
    try:
        cur = conn.cursor()
        # Get listing details
        cur.execute("""
            SELECT farmer_id, title, quantity, price 
            FROM listings 
            WHERE id = %s AND status = 'available';
        """, (listing_id,))
        listing = cur.fetchone()
        
        if not listing:
            cur.close()
            return jsonify({'error': 'Listing not found or not available'}), 404
        
        farmer_id, crop_title, quantity, price = listing
        
        # Create purchase request
        cur.execute("""
            INSERT INTO purchase_requests 
            (listing_id, buyer_id, farmer_id, crop_title, quantity, price, payment_proof, status)
            VALUES (%s, %s, %s, %s, %s, %s, %s, 'pending') RETURNING id;
        """, (listing_id, buyer_id, farmer_id, crop_title, quantity, price, payment_proof))
        
        request_id = cur.fetchone()[0]
        conn.commit()
        cur.close()
        return jsonify({'id': request_id, 'message': 'Purchase request submitted'}), 201
    except Exception as e:
        print(f"Error creating purchase request: {e}")
        return jsonify({'error': 'Failed to create purchase request'}), 500
    finally:
        conn.close()

# Get purchase requests for farmer
@app.route('/api/purchase-requests/farmer/<farmer_id>', methods=['GET'])
def get_farmer_purchase_requests(farmer_id):
    conn = get_db_connection()
    if conn is None:
        return jsonify({'error': 'DB connection failed'}), 500
    try:
        cur = conn.cursor()
        cur.execute("""
            SELECT id, listing_id, buyer_id, crop_title, quantity, price, 
                   payment_proof, status, created_at 
            FROM purchase_requests 
            WHERE farmer_id = %s 
            ORDER BY created_at DESC;
        """, (farmer_id,))
        requests = cur.fetchall()
        cur.close()
        return jsonify([{
            'id': row[0],
            'listing_id': row[1],
            'buyer_id': row[2],
            'crop_title': row[3],
            'quantity': row[4],
            'price': float(row[5]) if row[5] is not None else None,
            'payment_proof': row[6],
            'status': row[7],
            'created_at': row[8].isoformat() if row[8] else None
        } for row in requests]), 200
    except Exception as e:
        print(f"Error fetching purchase requests: {e}")
        return jsonify({'error': 'Failed to fetch requests'}), 500
    finally:
        conn.close()

# Get purchase requests for buyer
@app.route('/api/purchase-requests/buyer/<buyer_id>', methods=['GET'])
def get_buyer_purchase_requests(buyer_id):
    conn = get_db_connection()
    if conn is None:
        return jsonify({'error': 'DB connection failed'}), 500
    try:
        cur = conn.cursor()
        cur.execute("""
            SELECT id, listing_id, farmer_id, crop_title, quantity, price, 
                   status, created_at 
            FROM purchase_requests 
            WHERE buyer_id = %s 
            ORDER BY created_at DESC;
        """, (buyer_id,))
        requests = cur.fetchall()
        cur.close()
        return jsonify([{
            'id': row[0],
            'listing_id': row[1],
            'farmer_id': row[2],
            'crop_title': row[3],
            'quantity': row[4],
            'price': float(row[5]) if row[5] is not None else None,
            'status': row[6],
            'created_at': row[7].isoformat() if row[7] else None
        } for row in requests]), 200
    except Exception as e:
        print(f"Error fetching purchase requests: {e}")
        return jsonify({'error': 'Failed to fetch requests'}), 500
    finally:
        conn.close()

# Approve/Reject purchase request
@app.route('/api/purchase-request/<int:request_id>/status', methods=['PUT'])
def update_purchase_request_status(request_id):
    data = request.get_json()
    status = data.get('status')  # 'approved' or 'rejected'
    
    if status not in ['approved', 'rejected']:
        return jsonify({'error': 'Invalid status'}), 400

    conn = get_db_connection()
    if conn is None:
        return jsonify({'error': 'DB connection failed'}), 500
    try:
        cur = conn.cursor()
        # Get request details
        cur.execute("""
            SELECT listing_id FROM purchase_requests WHERE id = %s;
        """, (request_id,))
        result = cur.fetchone()
        
        if not result:
            cur.close()
            return jsonify({'error': 'Request not found'}), 404
        
        listing_id = result[0]
        
        # Update request status
        cur.execute("""
            UPDATE purchase_requests 
            SET status = %s 
            WHERE id = %s;
        """, (status, request_id))
        
        # If approved, mark listing as sold
        if status == 'approved':
            cur.execute("""
                UPDATE listings 
                SET status = 'sold' 
                WHERE id = %s;
            """, (listing_id,))
        
        conn.commit()
        cur.close()
        return jsonify({'message': f'Request {status}'}), 200
    except Exception as e:
        print(f"Error updating purchase request: {e}")
        return jsonify({'error': 'Failed to update request'}), 500
    finally:
        conn.close()

# Initialize DB when app starts
init_db()

if __name__ == '__main__':
    app.run(debug=True)