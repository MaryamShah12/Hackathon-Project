from flask import Flask, request, jsonify
from flask_cors import CORS
import psycopg2
import bcrypt

app = Flask(__name__)
CORS(app)

# Hardcoded DB credentials (for trial only)
DB_HOST = "harvesthub-db.c9swieksgef8.eu-north-1.rds.amazonaws.com"
DB_PORT = "5432"
DB_NAME = "harvesthub"
DB_USER = "HarvestHub"
DB_PASSWORD = "HarvestHub2025!"

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
        cur.execute("""
            CREATE TABLE IF NOT EXISTS users (
                username VARCHAR(100) PRIMARY KEY,
                password VARCHAR(100) NOT NULL,
                role VARCHAR(50) NOT NULL
            );
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
        conn.commit()
        cur.close()
        print("Tables created or already exist")
    except Exception as e:
        print(f"Error creating tables: {e}")
    finally:
        conn.close()

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
            INSERT INTO listings (title, quantity, type, farmer_id, farmer_name, available_date, price)
            VALUES (%s, %s, %s, %s, %s, %s, %s) RETURNING id;
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

# Get all listings
@app.route('/api/listings', methods=['GET'])
def get_listings():
    conn = get_db_connection()
    if conn is None:
        return jsonify({'error': 'DB connection failed'}), 500
    try:
        cur = conn.cursor()
        cur.execute("SELECT id, title, quantity, type, farmer_id, farmer_name, available_date, price FROM listings;")
        listings = cur.fetchall()
        cur.close()
        return jsonify([{
            'id': row[0],
            'title': row[1],
            'quantity': row[2],
            'type': row[3],
            'farmer_id': row[4],
            'farmer_name': row[5],
            'available_date': row[6],
            'price': row[7]
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

@app.route('/test_db')
def test_db():
    conn = get_db_connection()
    if conn:
        conn.close()
        return 'DB Connection Successful!'
    else:
        return 'DB Connection Failed!'

@app.route('/')
def home():
    return 'Harvest Hub Backend is running!'

# Initialize DB when app starts
init_db()

if __name__ == '__main__':
    app.run(debug=True)