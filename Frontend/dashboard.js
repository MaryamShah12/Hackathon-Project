// dashboard.js
const activeUser = JSON.parse(localStorage.getItem("activeUser"));

// Role check
if (!activeUser || activeUser.role !== role) {
    alert(
        `⚠️ Unauthorized! Please login as ${
            role.charAt(0).toUpperCase() + role.slice(1)
        }.`
    );
    window.location.href = "login.html";
}

// Logout
const logoutBtn = document.getElementById("logoutBtn");
if (logoutBtn) {
    logoutBtn.addEventListener("click", () => {
        localStorage.removeItem("activeUser");
        window.location.href = "login.html";
    });
}

// Fetch listings from API
async function fetchListings() {
    try {
        console.log('Fetching listings...');
        const response = await fetch('http://localhost:5000/api/listings');
        if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
        }
        const listings = await response.json();
        console.log('Listings fetched:', listings);
        return listings;
    } catch (error) {
        console.error('Error fetching listings:', error);
        alert('Failed to fetch listings');
        return [];
    }
}

// Render Listings
async function renderListings() {
    console.log('Rendering listings...');
    const container = document.getElementById(role === "farmer" ? "listingList" : "listings");
    if (!container) {
        console.error('Listing container not found!');
        alert('Error: Listing container not found in HTML');
        return;
    }
    container.innerHTML = "";

    const listings = await fetchListings();
    let filtered = listings;

    // Apply filters
    const searchInput = document.getElementById("search");
    const filterType = document.getElementById("filterType");
    const sortBy = document.getElementById("sortBy");

    if (role === "farmer") {
        filtered = listings.filter((l) => l.farmer_id === activeUser.username);
    } else if (role === "buyer") {
        filtered = listings.filter((l) => l.type === "sell" || l.type === "barter");
    } else if (role === "ngo") {
        filtered = listings.filter((l) => l.type === "donate");
    }

    // Search filter
    if (searchInput && searchInput.value) {
        const searchTerm = searchInput.value.toLowerCase();
        filtered = filtered.filter((l) => l.title.toLowerCase().includes(searchTerm));
    }

    // Type filter
    if (filterType && filterType.value !== "all") {
        filtered = filtered.filter((l) => l.type === filterType.value);
    }

    // Sort
    if (sortBy && sortBy.value) {
        filtered = filtered.sort((a, b) => {
            if (sortBy.value === "new") {
                return new Date(b.available_date) - new Date(a.available_date);
            } else if (sortBy.value === "priceAsc") {
                return (a.price || 0) - (b.price || 0);
            } else if (sortBy.value === "priceDesc") {
                return (b.price || 0) - (a.price || 0);
            }
            return 0;
        });
    }

    if (filtered.length === 0) {
        container.innerHTML = `<${role === "farmer" ? "li" : "div"} class="muted">No listings available.</${role === "farmer" ? "li" : "div"}>`;
        return;
    }

    filtered.forEach((it) => {
        const element = document.createElement(role === "farmer" ? "li" : "div");
        element.className = role === "farmer" ? "listing card" : "listing card listings-grid-item";
        element.innerHTML = `
            <h3>${it.title}</h3>
            <p><strong>Qty:</strong> ${it.quantity}</p>
            <p><strong>Type:</strong> ${it.type}</p>
            <p><strong>Available:</strong> ${it.available_date || "Not specified"}</p>
            <p><strong>Price:</strong> ${it.price ? `$${it.price.toFixed(2)}` : "N/A"}</p>
            <p><strong>Farmer:</strong> ${it.farmer_name || "Unknown"}</p>
        `;

        if (role === "buyer" && (it.type === "sell" || it.type === "barter")) {
            const btn = document.createElement("button");
            btn.textContent = it.type === "sell" ? "Buy" : "Offer/Barter";
            btn.className = "small";
            btn.addEventListener("click", () => {
                alert(`Action sent to farmer: ${it.farmer_name}`);
            });
            element.appendChild(btn);
        }

        if (role === "ngo" && it.type === "donate") {
            const btn = document.createElement("button");
            btn.textContent = "Claim Donation";
            btn.className = "small";
            btn.addEventListener("click", () => {
                alert(`Donation claimed from farmer: ${it.farmer_name}`);
            });
            element.appendChild(btn);
        }

        if (role === "farmer") {
            const editBtn = document.createElement("button");
            editBtn.textContent = "Edit";
            editBtn.className = "small";
            const delBtn = document.createElement("button");
            delBtn.textContent = "Delete";
            delBtn.className = "small danger";

            delBtn.addEventListener("click", async () => {
                if (confirm("Delete this listing?")) {
                    try {
                        const response = await fetch(`http://localhost:5000/api/listings/${it.id}`, {
                            method: 'DELETE'
                        });
                        if (response.ok) {
                            alert('Listing deleted!');
                            renderListings();
                        } else {
                            const result = await response.json();
                            alert('Error: ' + result.error);
                        }
                    } catch (error) {
                        console.error('Error deleting listing:', error);
                        alert('Failed to delete listing');
                    }
                }
            });

            element.appendChild(editBtn);
            element.appendChild(delBtn);
        }

        container.appendChild(element);
    });
}

// Add new listing (Farmer only)
const listingForm = document.getElementById("listingForm");
if (listingForm && role === "farmer") {
    listingForm.addEventListener("submit", async (event) => {
        event.preventDefault();
        const title = document.getElementById("cropName")?.value;
        const quantity = document.getElementById("cropQuantity")?.value;
        const type = document.getElementById("listingType")?.value;
        const available_date = document.getElementById("availableDate")?.value;
        const price = parseFloat(document.getElementById("price")?.value) || null;

        console.log('Adding listing:', { title, quantity, type, available_date, price, farmer_id: activeUser.username });

        if (!title || !quantity || !type || !available_date) {
            alert("Please enter all required fields");
            return;
        }

        const newListing = {
            title,
            quantity,
            type,
            farmer_id: activeUser.username,
            farmer_name: activeUser.username,
            available_date,
            price
        };

        try {
            const response = await fetch('http://localhost:5000/api/listings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(newListing)
            });
            if (response.ok) {
                alert('Listing added!');
                listingForm.reset();
                renderListings();
            } else {
                const result = await response.json();
                alert('Error: ' + result.error);
            }
        } catch (error) {
            console.error('Error adding listing:', error);
            alert('Failed to add listing');
        }
    });
} else {
    console.log('listingForm or farmer role not found:', { listingForm, role });
}

// Add filter and sort listeners
function setupFilters() {
    const searchInput = document.getElementById("search");
    const filterType = document.getElementById("filterType");
    const sortBy = document.getElementById("sortBy");

    if (searchInput) {
        searchInput.addEventListener("input", () => renderListings());
    }
    if (filterType) {
        filterType.addEventListener("change", () => renderListings());
    }
    if (sortBy) {
        sortBy.addEventListener("change", () => renderListings());
    }
}

// Run on load
document.addEventListener('DOMContentLoaded', () => {
    console.log('Page loaded, role:', role, 'activeUser:', activeUser);
    renderListings();
    setupFilters();
});