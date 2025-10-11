// analytics.js
const activeUser = JSON.parse(localStorage.getItem("activeUser"));

if (!activeUser) {
    alert("Please login first");
    window.location.href = "login.html";
}

// Logout handler
const logoutBtn = document.getElementById("logoutBtn");
if (logoutBtn) {
    logoutBtn.addEventListener("click", () => {
        localStorage.removeItem("activeUser");
        window.location.href = "login.html";
    });
}

// Fetch and render analytics
async function loadAnalytics() {
    const endpoint = `http://localhost:5000/api/analytics/${role}/${activeUser.username}`;
    
    try {
        const response = await fetch(endpoint);
        if (!response.ok) throw new Error('Failed to fetch analytics');
        
        const data = await response.json();
        renderAnalytics(data);
    } catch (error) {
        console.error('Error loading analytics:', error);
        document.getElementById('summary').textContent = 'Failed to load analytics';
    }
}

function renderAnalytics(data) {
    if (role === 'farmer') {
        renderFarmerAnalytics(data);
    } else if (role === 'buyer') {
        renderBuyerAnalytics(data);
    } else if (role === 'ngo') {
        renderNgoAnalytics(data);
    }
}

function renderFarmerAnalytics(data) {
    // Update summary
    document.getElementById('summary').innerHTML = `
        You sold <strong>${data.total_quantity.toFixed(1)} kg</strong> crops and earned 
        <strong>Rs. ${data.total_earnings.toFixed(2)}</strong> total.
    `;
    
    // Chart 1: Listing types (Pie chart)
    const typeData = [{
        values: [data.sell_count, data.barter_count, data.donate_count],
        labels: ['Sell', 'Barter', 'Donate'],
        type: 'pie',
        marker: {
            colors: ['#4caf50', '#ff9800', '#2196f3']
        },
        textinfo: 'label+percent',
        hoverinfo: 'label+value+percent'
    }];
    
    const typeLayout = {
        title: 'Listing Distribution by Type',
        showlegend: true,
        height: 380,
        margin: { t: 40, b: 20, l: 20, r: 20 }
    };
    
    Plotly.newPlot('quantity-chart', typeData, typeLayout, {
        responsive: true,
        displayModeBar: false
    });
    
    // Chart 2: Monthly earnings (Bar chart with animation)
    const months = Object.keys(data.monthly_data).sort();
    const earnings = months.map(m => data.monthly_data[m].earnings);
    
    const earningsData = [{
        x: months,
        y: earnings,
        type: 'bar',
        marker: {
            color: '#4caf50',
            line: { color: '#2e7d32', width: 1.5 }
        },
        text: earnings.map(e => `Rs. ${e.toFixed(2)}`),
        textposition: 'outside',
        hovertemplate: '<b>%{x}</b><br>Earnings: Rs. %{y:.2f}<extra></extra>'
    }];
    
    const earningsLayout = {
        title: 'Monthly Earnings',
        xaxis: { title: 'Month' },
        yaxis: { title: 'Earnings (Rs.)' },
        height: 380,
        margin: { t: 40, b: 60, l: 60, r: 20 }
    };
    
    Plotly.newPlot('secondary-chart', earningsData, earningsLayout, {
        responsive: true,
        displayModeBar: false
    }).then(() => {
        // Animate bars growing
        Plotly.animate('secondary-chart', {
            data: earningsData,
            traces: [0],
            layout: {}
        }, {
            transition: { duration: 1000, easing: 'cubic-in-out' },
            frame: { duration: 1000 }
        });
    });
}

function renderBuyerAnalytics(data) {
    document.getElementById('summary').innerHTML = `
        <strong>${data.total_listings}</strong> listings available. 
        Average savings: <strong>Rs. ${data.avg_savings_per_item.toFixed(2)}</strong> per item.
    `;
    
    // Chart 1: Available crop types (Horizontal bar)
    const crops = Object.keys(data.crop_types);
    const counts = crops.map(c => data.crop_types[c]);
    
    const cropData = [{
        y: crops,
        x: counts,
        type: 'bar',
        orientation: 'h',
        marker: {
            color: '#66bb6a',
            line: { color: '#388e3c', width: 1 }
        },
        hovertemplate: '<b>%{y}</b><br>Count: %{x}<extra></extra>'
    }];
    
    const cropLayout = {
        title: 'Available Crops',
        xaxis: { title: 'Number of Listings' },
        yaxis: { title: 'Crop Type' },
        height: 380,
        margin: { t: 40, b: 60, l: 100, r: 20 }
    };
    
    Plotly.newPlot('quantity-chart', cropData, cropLayout, {
        responsive: true,
        displayModeBar: false
    });
    
    // Chart 2: Savings potential (Gauge)
    const gaugeData = [{
        type: "indicator",
        mode: "gauge+number+delta",
        value: data.avg_savings_per_item,
        title: { text: "Avg Savings per Item (Rs.)" },
        delta: { reference: 100 },
        gauge: {
            axis: { range: [null, 200] },
            bar: { color: "#4caf50" },
            steps: [
                { range: [0, 50], color: "#c8e6c9" },
                { range: [50, 100], color: "#81c784" },
                { range: [100, 200], color: "#66bb6a" }
            ],
            threshold: {
                line: { color: "red", width: 4 },
                thickness: 0.75,
                value: 150
            }
        }
    }];
    
    const gaugeLayout = {
        height: 380,
        margin: { t: 20, b: 20, l: 20, r: 20 }
    };
    
    Plotly.newPlot('secondary-chart', gaugeData, gaugeLayout, {
        responsive: true,
        displayModeBar: false
    });
}

function renderNgoAnalytics(data) {
    document.getElementById('summary').innerHTML = `
        You received <strong>${data.total_claimed_quantity.toFixed(1)} kg</strong> of donated food 
        (<strong>${data.claimed_count}</strong> donations). <strong>${data.available_count}</strong> available now.
    `;
    
    // Chart 1: Claimed vs Available (Pie)
    const statusData = [{
        values: [data.claimed_count, data.available_count],
        labels: ['Claimed by You', 'Available'],
        type: 'pie',
        marker: {
            colors: ['#2196f3', '#ff9800']
        },
        textinfo: 'label+value',
        hoverinfo: 'label+value+percent'
    }];
    
    const statusLayout = {
        title: 'Donation Status',
        showlegend: true,
        height: 380,
        margin: { t: 40, b: 20, l: 20, r: 20 }
    };
    
    Plotly.newPlot('quantity-chart', statusData, statusLayout, {
        responsive: true,
        displayModeBar: false
    });
    
    // Chart 2: Monthly claims (Line chart)
    const months = Object.keys(data.monthly_claims).sort();
    const quantities = months.map(m => data.monthly_claims[m]);
    
    const monthlyData = [{
        x: months,
        y: quantities,
        type: 'scatter',
        mode: 'lines+markers',
        line: {
            color: '#2196f3',
            width: 3,
            shape: 'spline'
        },
        marker: {
            size: 10,
            color: '#1976d2'
        },
        fill: 'tozeroy',
        fillcolor: 'rgba(33, 150, 243, 0.1)',
        hovertemplate: '<b>%{x}</b><br>Quantity: %{y:.1f} kg<extra></extra>'
    }];
    
    const monthlyLayout = {
        title: 'Monthly Food Received (kg)',
        xaxis: { title: 'Month' },
        yaxis: { title: 'Quantity (kg)' },
        height: 380,
        margin: { t: 40, b: 60, l: 60, r: 20 }
    };
    
    Plotly.newPlot('secondary-chart', monthlyData, monthlyLayout, {
        responsive: true,
        displayModeBar: false
    }).then(() => {
        // Animate line drawing
        Plotly.animate('secondary-chart', {
            data: monthlyData,
            traces: [0],
            layout: {}
        }, {
            transition: { duration: 1500, easing: 'cubic-in-out' },
            frame: { duration: 1500 }
        });
    });
}

// Load on page ready
document.addEventListener('DOMContentLoaded', loadAnalytics);