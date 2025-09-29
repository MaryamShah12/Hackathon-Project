// auth.js

// Handle Register
if (document.getElementById("registerForm")) {
  document
    .getElementById("registerForm")
    .addEventListener("submit", async function (e) {
      e.preventDefault();

      const username = document.getElementById("regUsername").value.trim();
      const password = document.getElementById("regPassword").value.trim();
      const role = document.getElementById("regRole").value;

      if (!username || !password || !role) {
        alert("Please fill in all fields");
        return;
      }

      try {
        const response = await fetch('http://localhost:5000/api/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username, password, role })
        });
        const result = await response.json();
        if (response.ok) {
          alert("✅ Registration successful! Please login.");
          window.location.href = "login.html";
        } else {
          alert("❌ " + result.error);
        }
      } catch (error) {
        console.error('Error registering:', error);
        alert("❌ Failed to register");
      }
    });
}

// Handle Login
if (document.getElementById("loginForm")) {
  document.getElementById("loginForm").addEventListener("submit", async function (e) {
    e.preventDefault();

    const username = document.getElementById("loginUsername").value.trim();
    const password = document.getElementById("loginPassword").value.trim();

    try {
      const response = await fetch('http://localhost:5000/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      const result = await response.json();
      if (response.ok) {
        localStorage.setItem("activeUser", JSON.stringify({
          username: result.username,
          role: result.role
        }));
        if (result.role === "farmer") {
          window.location.href = "farmer.html";
        } else if (result.role === "buyer") {
          window.location.href = "buyer.html";
        } else if (result.role === "ngo") {
          window.location.href = "ngo.html";
        }
      } else {
        alert("❌ " + result.error);
      }
    } catch (error) {
      console.error('Error logging in:', error);
      alert("❌ Failed to login");
    }
  });
}