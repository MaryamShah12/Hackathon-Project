// dashboard.js
const activeUser = JSON.parse(localStorage.getItem("activeUser"));
window.activeUser = activeUser;
// Role check
if (!activeUser || (activeUser.role !== "ngo" && role === "ngo") || (activeUser.role !== "ngo" && role === "ngo_profile") || (activeUser.role !== "farmer" && role === "farmer") || (activeUser.role !== "buyer" && role === "buyer")) {
    alert(
        `⚠️ Unauthorized! Please login as ${
            role === "ngo_profile" ? "NGO" : role.charAt(0).toUpperCase() + role.slice(1)
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
        listings.forEach((listing, index) => {
            console.log(`Listing ${index}: id = ${listing.id}, title = ${listing.title}, price = ${listing.price}, type = ${typeof listing.price}, status = ${listing.status}`);
        });
        return listings;
    } catch (error) {
        console.error('Error fetching listings:', error);
        alert('Failed to fetch listings. Check console for details.');
        return [];
    }
}

// Render Listings
async function renderListings() {
    if (role === "ngo_profile") return; // Skip for profile page

    console.log('Rendering listings for role:', role);
    const sellContainer = document.getElementById("sellList");
    const barterContainer = document.getElementById("barterList");
    const availableDonateContainer = document.getElementById("availableDonateList");
    const claimedDonateContainer = document.getElementById("claimedDonateList");

    if (role === "farmer" && (!sellContainer || !barterContainer || !availableDonateContainer || !claimedDonateContainer)) {
        console.error('Listing containers not found!');
        return;
    }

    if (role === "farmer") {
        [sellContainer, barterContainer, availableDonateContainer, claimedDonateContainer].forEach(cont => cont.innerHTML = "");
    }

    const listings = await fetchListings();
    let filtered = listings;

    console.log('Total listings before filtering:', filtered.length);

    if (role === "farmer") {
        filtered = filtered.filter((l) => l.farmer_id === activeUser.username);
        console.log('Farmer listings after filtering:', filtered.length);
    } else if (role === "buyer") {
        filtered = filtered.filter((l) => (l.type === "sell" || l.type === "barter") && l.status === "available");
        console.log('Buyer listings after filtering:', filtered.length);
    } else if (role === "ngo") {
        filtered = filtered.filter((l) => l.type === "donate" && l.status === "available");
        console.log('NGO listings after filtering:', filtered.length);
    }

    // Apply search, filter, and sort for non-farmer roles
    if (role !== "farmer") {
        const searchInput = document.getElementById("search");
        const filterType = document.getElementById("filterType");
        const sortBy = document.getElementById("sortBy");

        if (searchInput && searchInput.value) {
            const searchTerm = searchInput.value.toLowerCase();
            filtered = filtered.filter((l) => l.title.toLowerCase().includes(searchTerm));
            console.log('After search filter:', filtered.length);
        }

        if (filterType && filterType.value !== "all") {
            filtered = filtered.filter((l) => l.type === filterType.value);
            console.log('After type filter:', filtered.length);
        }

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

        const container = document.getElementById("listings");
        if (container) {
            container.innerHTML = "";
            console.log('Rendering', filtered.length, 'listings in container');
            
            if (filtered.length === 0) {
                container.innerHTML = `<div class="muted" style="grid-column: 1 / -1; text-align: center; padding: 20px;">No listings available.</div>`;
                return;
            }
            
            filtered.forEach((it) => {
                console.log('Rendering listing:', it.title);
                const element = document.createElement("div");
                element.className = "listing";
                let html = `
                    <div class="listing-info">
                        <h3>${it.title}</h3>
                        <p><strong>Qty:</strong> ${it.quantity}</p>
                        <p><strong>Type:</strong> ${it.type}</p>
                        <p><strong>Available:</strong> ${it.available_date || "Not specified"}</p>
                        <p><strong>Price:</strong> ${typeof it.price === 'number' && !isNaN(it.price) ? `Rs. ${it.price.toFixed(2)}` : "N/A"}</p>
                        <p><strong>Farmer:</strong> ${it.farmer_name || "Unknown"}</p>
                    </div>
                `;

                element.innerHTML = html;

        if (role === "buyer" && (it.type === "sell" || it.type === "barter")) {
    const btn = document.createElement("button");
    btn.textContent = it.type === "sell" ? "Buy Now" : "Offer/Barter";
    btn.className = "small";
    btn.addEventListener("click", () => {
        if (it.type === "sell") {
            // Redirect to payment page
            window.location.href = `payment.html?listing=${it.id}`;
        } else {
            alert(`Barter request sent to farmer: ${it.farmer_name}`);
        }
    });
    element.appendChild(btn);
}

                if (role === "ngo" && it.type === "donate") {
                    const btn = document.createElement("button");
                    btn.textContent = "Claim Donation";
                    btn.className = "small";
                    btn.addEventListener("click", () => claimDonation(it.id));
                    element.appendChild(btn);
                }

                container.appendChild(element);
            });
            console.log('Finished rendering all listings');
        } else {
            console.error('Container #listings not found!');
        }
        return;
    }

    // Farmer-specific rendering
    if (filtered.length === 0) {
        sellContainer.innerHTML = `<li class="muted">No sell listings.</li>`;
        barterContainer.innerHTML = `<li class="muted">No barter listings.</li>`;
        availableDonateContainer.innerHTML = `<li class="muted">No available donations.</li>`;
        claimedDonateContainer.innerHTML = `<li class="muted">No claimed donations.</li>`;
        return;
    }

    const sellListings = filtered.filter(l => l.type === "sell");
    const barterListings = filtered.filter(l => l.type === "barter");
    const donateAvailable = filtered.filter(l => l.type === "donate" && l.status === "available");
    const donateClaimed = filtered.filter(l => l.type === "donate" && l.status === "claimed");

    function renderGroup(listings, container) {
        if (listings.length === 0) {
            container.innerHTML = `<li class="muted">None available.</li>`;
            return;
        }
        listings.forEach((it) => {
            const element = document.createElement("li");
            element.className = "listing-item";
            let html = `
                <div class="listing-info">
                    <h3>${it.title}</h3>
                    <p><strong>Qty:</strong> ${it.quantity}</p>
                    <p><strong>Type:</strong> ${it.type}</p>
                    <p><strong>Available:</strong> ${it.available_date || "Not specified"}</p>
                    <p><strong>Price:</strong> ${typeof it.price === 'number' && !isNaN(it.price) ? `Rs. ${it.price.toFixed(2)}` : "N/A"}</p>
                    <p><strong>Farmer:</strong> ${it.farmer_name || "Unknown"}</p>
                    <p><strong>Status:</strong> ${it.status}${it.claimed_by ? ` by ${it.claimed_by}` : ""}</p>
                </div>
            `;

            element.innerHTML = html;

            if (it.status === "available") {
                const actions = document.createElement("div");
                actions.className = "actions";
                const editBtn = document.createElement("button");
                editBtn.textContent = "Edit";
                editBtn.className = "small";
                editBtn.addEventListener("click", () => openEditModal(it));
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
                actions.appendChild(editBtn);
                actions.appendChild(delBtn);
                element.appendChild(actions);
            }

            container.appendChild(element);
        });
    }

    renderGroup(sellListings, sellContainer);
    renderGroup(barterListings, barterContainer);
    renderGroup(donateAvailable, availableDonateContainer);
    renderGroup(donateClaimed, claimedDonateContainer);
}

// Claim donation function for NGO
async function claimDonation(id) {
    try {
        const response = await fetch(`http://localhost:5000/api/claim/${id}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ claimed_by: activeUser.username })
        });
        const result = await response.json();
        if (response.ok) {
            alert('Donation claimed! Confirmation sent to farmer.');
            renderListings();
        } else {
            alert('Error: ' + result.error);
        }
    } catch (error) {
        console.error('Error claiming donation:', error);
        alert('Failed to claim donation');
    }
}

// Fair Price Calculator Setup
function setupFairPriceCalculator(edit = false) {
    const wholesaleInput = document.getElementById(edit ? "editWholesalePrice" : "wholesalePrice");
    const retailInput = document.getElementById(edit ? "editRetailPrice" : "retailPrice");
    const priceInput = document.getElementById(edit ? "editPrice" : "price");

    if (wholesaleInput && retailInput && priceInput) {
        const calculate = () => {
            const wholesale = parseFloat(wholesaleInput.value);
            const retail = parseFloat(retailInput.value);
            if (!isNaN(wholesale) && !isNaN(retail) && wholesale > 0 && retail > wholesale) {
                const fairPrice = (wholesale + retail) / 2;
                priceInput.value = fairPrice.toFixed(2);
                return true;
            }
            return false;
        };
        wholesaleInput.addEventListener("input", calculate);
        retailInput.addEventListener("input", calculate);
        return calculate;
    }
    return () => false;
}

// Toggle Fair Price Section
function toggleFairPriceSection(typeSelectId, sectionId, edit = false) {
    const typeSelect = document.getElementById(typeSelectId);
    const section = document.getElementById(sectionId);
    if (typeSelect && section) {
        const toggle = () => {
            section.style.display = typeSelect.value === "sell" ? "block" : "none";
            if (typeSelect.value !== "sell") {
                document.getElementById(edit ? "editPrice" : "price").value = "";
            }
        };
        typeSelect.addEventListener("change", toggle);
        toggle();
    }
}

// Open Edit Modal
function openEditModal(listing) {
    const modal = document.getElementById("editModal");
    if (!modal) return;

    document.getElementById("editListingId").value = listing.id;
    document.getElementById("editCropName").value = listing.title;
    document.getElementById("editCropQuantity").value = listing.quantity;
    document.getElementById("editListingType").value = listing.type;
    document.getElementById("editAvailableDate").value = listing.available_date;
    document.getElementById("editPrice").value = listing.price !== null ? listing.price : "";
    document.getElementById("editWholesalePrice").value = "";
    document.getElementById("editRetailPrice").value = "";

    toggleFairPriceSection("editListingType", "editFairPriceSection", true);
    modal.style.display = "block";
}

// Close Modal
const closeModal = document.querySelector(".close");
if (closeModal) {
    closeModal.addEventListener("click", () => {
        document.getElementById("editModal").style.display = "none";
    });
}

// Submit Edit
const editForm = document.getElementById("editForm");
if (editForm) {
    const calculateEditFairPrice = setupFairPriceCalculator(true);
    editForm.addEventListener("submit", async (event) => {
        event.preventDefault();
        const id = document.getElementById("editListingId").value;
        const title = document.getElementById("editCropName").value;
        const quantity = document.getElementById("editCropQuantity").value;
        const type = document.getElementById("editListingType").value;
        const available_date = document.getElementById("editAvailableDate").value;
        let price = parseFloat(document.getElementById("editPrice").value);

        if (!title || !quantity || !type || !available_date) {
            alert("Enter all required fields");
            return;
        }

        if (type === "sell") {
            const wholesale = document.getElementById("editWholesalePrice").value;
            const retail = document.getElementById("editRetailPrice").value;
            if (wholesale && retail) {
                if (!calculateEditFairPrice()) {
                    alert("Invalid wholesale or retail prices");
                    return;
                }
                price = parseFloat(document.getElementById("editPrice").value);
            } else if (isNaN(price)) {
                alert("Price required for sell type");
                return;
            }
        } else {
            price = isNaN(price) ? null : price;
        }

        const updatedListing = {
            title,
            quantity,
            type,
            farmer_id: activeUser.username,
            farmer_name: activeUser.username,
            available_date,
            price
        };

        console.log('Sending updated listing:', updatedListing);

        try {
            const response = await fetch(`http://localhost:5000/api/listings/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updatedListing)
            });
            const result = await response.json();
            if (response.ok) {
                alert('Listing updated!');
                modal.style.display = "none";
                renderListings();
            } else {
                alert('Error: ' + result.error);
            }
        } catch (error) {
            console.error('Error updating listing:', error);
            alert('Failed to update listing');
        }
    });
}

// Add new listing (Farmer only)
const listingForm = document.getElementById("listingForm");
if (listingForm && role === "farmer") {
    const calculateFairPrice = setupFairPriceCalculator();
    toggleFairPriceSection("listingType", "fairPriceSection");
    listingForm.addEventListener("submit", async (event) => {
        event.preventDefault();
        const title = document.getElementById("cropName").value;
        const quantity = document.getElementById("cropQuantity").value;
        const type = document.getElementById("listingType").value;
        const available_date = document.getElementById("availableDate").value;
        let price = parseFloat(document.getElementById("price").value) || null;

        if (!title || !quantity || !type || !available_date) {
            alert("Enter all required fields");
            return;
        }

        if (type === "sell" && !calculateFairPrice()) {
            alert("Please enter valid wholesale and retail prices for sell");
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
            const result = await response.json();
            if (response.ok) {
                alert('Listing added!');
                listingForm.reset();
                document.getElementById("fairPriceSection").style.display = "none";
                renderListings();
            } else {
                alert('Error: ' + result.error);
            }
        } catch (error) {
            console.error('Error adding listing:', error);
            alert('Failed to add listing');
        }
    });
}

// NGO Profile Functions
async function fetchNgoProfile() {
    if (role !== "ngo_profile") return null;
    try {
        const response = await fetch(`http://localhost:5000/api/ngo/profile?ngo_id=${activeUser.username}`);
        if (response.ok) {
            return await response.json();
        } else {
            return null;
        }
    } catch (error) {
        console.error('Error fetching NGO profile:', error);
        return null;
    }
}

async function renderNgoProfile() {
    if (role !== "ngo_profile") return;
    const profile = await fetchNgoProfile();
    const display = document.getElementById("profileDisplay");
    if (display) {
        if (profile) {
            display.innerHTML = `
                <h4>Saved Profile</h4>
                <p><strong>Organization:</strong> ${profile.org_name}</p>
                <p><strong>Contact:</strong> ${profile.contact}</p>
                <p><strong>Address:</strong> ${profile.address}</p>
                <p><strong>Focus Area:</strong> ${profile.focus_area}</p>
            `;
            document.getElementById("orgName").value = profile.org_name;
            document.getElementById("contact").value = profile.contact;
            document.getElementById("address").value = profile.address;
            document.getElementById("focusArea").value = profile.focus_area;
        } else {
            display.innerHTML = `<p class="muted">No profile yet. Fill out the form to create one.</p>`;
        }
    }
}

const profileForm = document.getElementById("profileForm");
if (profileForm && role === "ngo_profile") {
    profileForm.addEventListener("submit", async (event) => {
        event.preventDefault();
        const org_name = document.getElementById("orgName").value;
        const contact = document.getElementById("contact").value;
        const address = document.getElementById("address").value;
        const focus_area = document.getElementById("focusArea").value;

        if (!org_name || !contact || !address || !focus_area) {
            alert("Enter all required fields");
            return;
        }

        const profileData = {
            ngo_id: activeUser.username,
            org_name,
            contact,
            address,
            focus_area
        };

        try {
            const response = await fetch('http://localhost:5000/api/ngo/profile', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(profileData)
            });
            const result = await response.json();
            if (response.ok) {
                alert('Profile updated!');
                renderNgoProfile();
            } else {
                alert('Error: ' + result.error);
            }
        } catch (error) {
            console.error('Error updating profile:', error);
            alert('Failed to update profile');
        }
    });
}

// Add filter and sort listeners for non-farmer roles
function setupFilters() {
    if (role === "ngo_profile") return;
    const searchInput = document.getElementById("search");
    const filterType = document.getElementById("filterType");
    const sortBy = document.getElementById("sortBy");

    if (searchInput) {
        searchInput.addEventListener("input", renderListings);
    }
    if (filterType) {
        filterType.addEventListener("change", renderListings);
    }
    if (sortBy) {
        sortBy.addEventListener("change", renderListings);
    }
}

// Tab functionality
function openTab(evt, tabName) {
    const tabContents = document.getElementsByClassName("tab-content");
    for (let i = 0; i < tabContents.length; i++) {
        tabContents[i].style.display = "none";
    }
    const tabButtons = document.getElementsByClassName("tab-btn");
    for (let i = 0; i < tabButtons.length; i++) {
        tabButtons[i].className = tabButtons[i].className.replace(" active", "");
    }
    document.getElementById(tabName).style.display = "block";
    evt.currentTarget.className += " active";
}

// Run on load
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM loaded, role:', role);
    if (role === "farmer") {
        const welcomeName = document.getElementById("welcomeName");
        if (welcomeName) welcomeName.textContent = activeUser.username;
        renderListings();
    } else if (role === "buyer" || role === "ngo") {
        setupFilters();
        renderListings();
    } else if (role === "ngo_profile") {
        renderNgoProfile();
    }
});