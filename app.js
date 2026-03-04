// ==========================================
// 1. CONFIGURATION
// ==========================================

const firebaseConfig = {
  apiKey: "AIzaSyCxzbCpPP5eCE0QbA1MPmNJVf0jEGk-v04",
  authDomain: "apps-5f2c2.firebaseapp.com",
  databaseURL: "https://apps-5f2c2-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "apps-5f2c2",
  storageBucket: "apps-5f2c2.firebasestorage.app",
  messagingSenderId: "198086671930",
  appId: "1:198086671930:web:61789ae168a5032afd3f03",
  measurementId: "G-SJ820VN3KF"
};


// GET FREE KEY FROM: https://api.imgbb.com/
const IMGBB_API_KEY = "83cdd14bdbb113e25ea67c22b5864208"; 

// THE GOOGLE EMAIL THAT HAS ADMIN ACCESS
const ADMIN_EMAIL = "sb5846868@gmail.com"; 

// ==========================================
// 2. INITIALIZATION
// ==========================================

import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-app.js";
import { getDatabase, ref, push, onValue, remove, update } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-database.js";
import { getAuth, signInWithPopup, GoogleAuthProvider, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-auth.js";

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
const auth = getAuth(app);
const provider = new GoogleAuthProvider();

// ==========================================
// 3. GLOBAL STATE & HELPERS
// ==========================================

let currentUser = null;
let cart = JSON.parse(localStorage.getItem('giftCart')) || [];

// Helper: Image Upload to ImgBB (Since we aren't using Firebase Storage)
async function uploadImage(file) {
    const formData = new FormData();
    formData.append("image", file);
    try {
        const response = await fetch(`https://api.imgbb.com/1/upload?key=${IMGBB_API_KEY}`, {
            method: "POST",
            body: formData
        });
        const data = await response.json();
        if(data.success) return data.data.url;
        throw new Error("Upload failed");
    } catch (error) {
        console.error(error);
        alert("Image upload failed. Check API Key or Network.");
        return null;
    }
}

// Helper: Navbar Updates
function updateNav() {
    const authBtn = document.getElementById('auth-btn');
    const adminLink = document.getElementById('admin-link');
    const cartCount = document.getElementById('cart-count');
    
    if (cartCount) cartCount.textContent = cart.length;

    if (currentUser) {
        if(authBtn) {
            authBtn.textContent = 'Logout';
            authBtn.onclick = logoutUser;
        }
        if (currentUser.email === ADMIN_EMAIL && adminLink) adminLink.style.display = 'block';
    } else {
        if(authBtn) {
            authBtn.textContent = 'Login';
            authBtn.onclick = loginUser;
        }
        if (adminLink) adminLink.style.display = 'none';
    }
}

async function loginUser() {
    try { await signInWithPopup(auth, provider); window.location.reload(); } catch (e) { alert(e.message); }
}

async function logoutUser() {
    await signOut(auth); window.location.reload();
}

// Auth State Listener
onAuthStateChanged(auth, (user) => {
    currentUser = user;
    updateNav();
    // Redirect non-admins trying to access admin panel
    if (window.location.pathname.includes('admin') && (!user || user.email !== ADMIN_EMAIL)) {
        window.location.href = 'index.html';
    }
});

// ==========================================
// 4. PAGE LOGIC
// ==========================================

// --- HOME PAGE ---
if (document.getElementById('product-grid')) {
    const catContainer = document.getElementById('cat-filters');
    const prodContainer = document.getElementById('product-grid');
    let activeCat = 'all';

    // Fetch Categories
    onValue(ref(db, 'categories'), (snapshot) => {
        const cats = snapshot.val() || {};
        catContainer.innerHTML = `<div class="cat-pill active" onclick="filterCat('all', this)">All</div>`;
        Object.entries(cats).forEach(([key, val]) => {
            catContainer.innerHTML += `<div class="cat-pill" onclick="filterCat('${key}', this)">${val.name}</div>`;
        });
    });

    // Fetch Products
    onValue(ref(db, 'products'), (snapshot) => {
        window.allProducts = snapshot.val() || {};
        renderProducts(window.allProducts);
    });

    window.filterCat = (catId, el) => {
        document.querySelectorAll('.cat-pill').forEach(c => c.classList.remove('active'));
        el.classList.add('active');
        activeCat = catId;
        renderProducts(window.allProducts);
    };

    function renderProducts(products) {
        prodContainer.innerHTML = '';
        Object.entries(products).forEach(([id, p]) => {
            if (activeCat === 'all' || p.category === activeCat) {
                // Determine lowest price to show "From $X"
                let displayPrice = p.price; 
                if(p.variants && p.variants.length > 0) {
                    displayPrice = Math.min(...p.variants.map(v => v.price));
                }

                prodContainer.innerHTML += `
                    <div class="product-card" onclick="window.location.href='product.html?id=${id}'">
                        <div class="p-img-wrapper"><img src="${p.image}" class="p-img" alt="${p.name}"></div>
                        <div class="p-details">
                            <div class="p-title">${p.name}</div>
                            <div class="p-price">RS.${displayPrice}</div>
                        </div>
                    </div>`;
            }
        });
    }
}

// --- PRODUCT DETAILS PAGE ---
if (document.getElementById('p-detail-container')) {
    const params = new URLSearchParams(window.location.search);
    const pid = params.get('id');
    let currentProduct = null;
    let selectedPrice = 0;
    let selectedVariantName = null;
    
    onValue(ref(db, 'products/' + pid), (snapshot) => {
        const p = snapshot.val();
        if(!p) return;
        currentProduct = p;
        
        document.getElementById('p-img').src = p.image;
        document.getElementById('p-title').textContent = p.name;
        document.getElementById('p-desc').textContent = p.description;
        
        // Handle Variants
        const variantSelect = document.getElementById('p-variant');
        if(p.variants && p.variants.length > 0) {
            variantSelect.innerHTML = '';
            p.variants.forEach((v, index) => {
                variantSelect.innerHTML += `<option value="${index}" data-price="${v.price}">${v.name} - RS.${v.price}</option>`;
            });
            // Init with first variant
            selectedPrice = p.variants[0].price;
            selectedVariantName = p.variants[0].name;
            document.getElementById('p-price').textContent = `RS.${selectedPrice}`;
        } else {
            // No variants, use base price
            variantSelect.parentElement.style.display = 'none';
            selectedPrice = p.price;
            selectedVariantName = "Standard";
            document.getElementById('p-price').textContent = `RS.${selectedPrice}`;
        }

        // Handle Custom Fields
        const customContainer = document.getElementById('custom-fields');
        customContainer.innerHTML = '';
        if (p.customFields) {
            p.customFields.forEach(field => {
                customContainer.innerHTML += `
                    <div class="input-group">
                        <label>${field}</label>
                        <input type="text" class="c-field" data-name="${field}" required>
                    </div>`;
            });
        }
    });

    // Update Price when dropdown changes
    document.getElementById('p-variant').addEventListener('change', (e) => {
        const idx = e.target.value;
        const v = currentProduct.variants[idx];
        selectedPrice = v.price;
        selectedVariantName = v.name;
        document.getElementById('p-price').textContent = `RS.${selectedPrice}`;
    });

    // Helper to gather data
    function getProductDataFromUI() {
        const inputs = document.querySelectorAll('.c-field');
        let customData = {};
        let valid = true;
        inputs.forEach(i => {
            if(!i.value) valid = false;
            customData[i.dataset.name] = i.value;
        });
        if(!valid) { alert("Please fill all required fields"); return null; }

        return {
            pid: pid,
            name: currentProduct.name,
            variant: selectedVariantName,
            price: Number(selectedPrice),
            image: currentProduct.image,
            customData: customData,
            qty: 1
        };
    }

    document.getElementById('add-cart-btn').onclick = () => {
        const item = getProductDataFromUI();
        if(item) {
            cart.push(item);
            localStorage.setItem('giftCart', JSON.stringify(cart));
            updateNav();
            alert('Added to cart');
        }
    };

    document.getElementById('buy-now-btn').onclick = () => {
        const item = getProductDataFromUI();
        if(item) {
            sessionStorage.setItem('buyNowItem', JSON.stringify([item]));
            window.location.href = 'checkout.html?mode=buynow';
        }
    };
}

// --- CART PAGE ---
if (document.getElementById('cart-items')) {
    const container = document.getElementById('cart-items');
    
    function renderCart() {
        container.innerHTML = '';
        let total = 0;
        if(cart.length === 0) container.innerHTML = '<p style="text-align:center; padding:20px;">Your cart is empty.</p>';
        
        cart.forEach((item, index) => {
            total += item.price;
            let meta = Object.entries(item.customData).map(([k,v]) => `<small>${k}: ${v}</small>`).join('<br>');
            container.innerHTML += `
                <div class="cart-item">
                    <img src="${item.image}" class="cart-thumb">
                    <div class="item-info">
                        <h4>${item.name}</h4>
                        <span style="background:#eee; padding:2px 6px; border-radius:4px; font-size:0.8rem;">${item.variant}</span>
                        <div style="margin-top:5px;">${meta}</div>
                        <div style="margin-top:5px; font-weight:bold; color:var(--primary);">$${item.price}</div>
                    </div>
                    <button class="btn btn-danger btn-sm" onclick="removeCart(${index})">Remove</button>
                </div>`;
        });
        document.getElementById('cart-total').textContent = `RS.${total}`;
    }

    window.removeCart = (index) => {
        cart.splice(index, 1);
        localStorage.setItem('giftCart', JSON.stringify(cart));
        updateNav();
        renderCart();
    };
    renderCart();
}

// --- CHECKOUT PAGE ---
if (document.getElementById('checkout-form')) {
    const params = new URLSearchParams(window.location.search);
    const isBuyNow = params.get('mode') === 'buynow';
    
    // 1. Load Items
    let checkoutItems = isBuyNow ? JSON.parse(sessionStorage.getItem('buyNowItem')) : cart;
    if(!checkoutItems || checkoutItems.length === 0) {
        alert("No items to checkout");
        window.location.href = 'index.html';
    }

    // 2. Summary & Total
    let total = checkoutItems.reduce((sum, item) => sum + Number(item.price), 0);
    document.getElementById('checkout-total').textContent = `RS.${total}`;
    
    const summaryDiv = document.getElementById('order-items-summary');
    checkoutItems.forEach(item => {
        summaryDiv.innerHTML += `
            <div style="display:flex; justify-content:space-between; border-bottom:1px solid #eee; padding:8px 0;">
                <span>${item.name} <small>(${item.variant})</small></span>
                <span>RS.${item.price}</span>
            </div>`;
    });

    // 3. Load Payment Methods
    let selectedPaymentMethod = null;
    const payGrid = document.getElementById('pay-method-grid');
    const payDetails = document.getElementById('pay-method-details');

    onValue(ref(db, 'paymentMethods'), (snap) => {
        const methods = snap.val() || {};
        payGrid.innerHTML = '';
        
        Object.values(methods).forEach((m, index) => {
            const card = document.createElement('div');
            card.className = 'pay-card';
            card.innerHTML = `<h4>${m.name}</h4>`;
            
            card.onclick = () => {
                document.querySelectorAll('.pay-card').forEach(c => c.classList.remove('selected'));
                card.classList.add('selected');
                
                selectedPaymentMethod = m.name;
                payDetails.style.display = 'block';
                payDetails.innerHTML = `
                    <div style="text-align:center; padding-bottom:10px; border-bottom:1px solid #eee; margin-bottom:10px;">
                        <h3 style="color:var(--primary);">${m.name}</h3>
                    </div>
                    ${m.image ? `<img src="${m.image}" class="pay-qr-img" alt="QR Code" style="max-width:200px; display:block; margin:0 auto 15px auto;">` : ''}
                    <div style="background:white; padding:15px; border-radius:5px; border:1px solid #eee;">
                        <p style="font-weight:600; margin-bottom:5px;">Instructions:</p>
                        <pre style="white-space:pre-wrap; font-family:inherit; color:#555;">${m.instructions}</pre>
                    </div>
                `;
            };
            payGrid.appendChild(card);
        });
    });

    // 4. Place Order
    document.getElementById('place-order-btn').onclick = async () => {
        const btn = document.getElementById('place-order-btn');
        const fileInput = document.getElementById('pay-proof-file');
        
        if (!currentUser) return alert('Please login first to place an order.');
        if (!selectedPaymentMethod) return alert('Please select a payment method.');
        if (fileInput.files.length === 0) return alert('Please upload the payment screenshot.');

        btn.disabled = true;
        btn.textContent = "Uploading Proof...";

        const imgUrl = await uploadImage(fileInput.files[0]);
        if(!imgUrl) {
            btn.disabled = false;
            btn.textContent = "Confirm Order";
            return;
        }

        btn.textContent = "Processing...";

        const orderData = {
            uid: currentUser.uid,
            email: currentUser.email,
            items: checkoutItems,
            total: total,
            paymentMethod: selectedPaymentMethod,
            proof: imgUrl,
            status: 'Pending',
            date: new Date().toISOString()
        };

        await push(ref(db, 'orders'), orderData);
        
        // Clear logic
        if(!isBuyNow) {
            cart = [];
            localStorage.setItem('giftCart', JSON.stringify(cart));
        } else {
            sessionStorage.removeItem('buyNowItem');
        }
        
        alert('Order Placed Successfully!');
        window.location.href = 'orders.html';
    };
}

// --- USER ORDERS PAGE ---
if (document.getElementById('user-orders')) {
    const container = document.getElementById('user-orders');
    onValue(ref(db, 'orders'), (snap) => {
        container.innerHTML = '';
        const allOrders = snap.val() || {};
        const sorted = Object.entries(allOrders).sort((a,b) => new Date(b[1].date) - new Date(a[1].date));
        
        sorted.forEach(([id, o]) => {
            if(o.uid === currentUser?.uid) {
                const statusClass = o.status === 'Approved' ? 'status-approved' : (o.status === 'Rejected' ? 'status-rejected' : 'status-pending');
                
                const itemsList = o.items.map(i => {
                    let meta = i.customData ? Object.entries(i.customData).map(([k,v]) => `${k}: ${v}`).join(', ') : '';
                    return `<div>• ${i.name} (${i.variant}) <span style="font-size:0.8em; color:#666">${meta}</span></div>`;
                }).join('');

                container.innerHTML += `
                    <div class="cart-item" style="display:block;">
                        <div style="display:flex; justify-content:space-between; margin-bottom:10px;">
                            <h4 style="margin:0;">Order #${id.substring(1,6)}</h4>
                            <span class="status-badge ${statusClass}">${o.status}</span>
                        </div>
                        <div style="margin-bottom:10px; padding-left:10px; border-left:3px solid #eee;">${itemsList}</div>
                        <div style="display:flex; justify-content:space-between; font-size:0.9rem; color:#555;">
                            <span>${new Date(o.date).toLocaleDateString()}</span>
                            <strong>Total: RS.${o.total}</strong>
                        </div>
                    </div>`;
            }
        });
    });
}

// ==========================================
// 5. ADMIN PANEL LOGIC
// ==========================================

if (document.getElementById('admin-app')) 
    
    // UI Tab Switcher
    window.switchTab = (tabId) => {
        document.querySelectorAll('.admin-section').forEach(s => s.classList.remove('active'));
        document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
        document.getElementById(tabId).classList.add('active');
        event.target.classList.add('active');
    };

    // --- ORDERS TAB ---
    const orderList = document.getElementById('adm-orders');
    onValue(ref(db, 'orders'), (snap) => {
        orderList.innerHTML = '';
        const data = snap.val() || {};
        Object.entries(data).reverse().forEach(([id, o]) => {
            const statusBadge = o.status === 'Approved' ? 'status-approved' : (o.status === 'Rejected' ? 'status-rejected' : 'status-pending');
            
            const itemsHtml = o.items.map(i => {
                let meta = i.customData ? Object.entries(i.customData).map(([k,v]) => `${k}: ${v}`).join(', ') : '';
                return `<li><strong>${i.name}</strong> (${i.variant}) - <small>${meta}</small></li>`;
            }).join('');

            orderList.innerHTML += `
                <div class="card" style="padding:20px; margin-bottom:20px;">
                    <div style="display:flex; justify-content:space-between; margin-bottom:10px;">
                         <div><strong>${o.email}</strong> <span class="status-badge ${statusBadge}" style="margin-left:10px;">${o.status}</span></div>
                         <div style="text-align:right;"><strong>$${o.total}</strong><br><small>${new Date(o.date).toLocaleDateString()}</small></div>
                    </div>
                    <div style="background:#f9fafb; padding:10px; border-radius:5px; margin-bottom:10px;">
                        <ul style="margin-left:20px; color:#555;">${itemsHtml}</ul>
                        <p style="margin-top:5px; font-size:0.9rem;"><strong>Method:</strong> ${o.paymentMethod}</p>
                    </div>
                    <div style="margin-bottom:10px;"><a href="${o.proof}" target="_blank" class="btn btn-sm btn-outline">View Payment Proof</a></div>
                    <div style="padding-top:10px; border-top:1px solid #eee;">
                        <label>Update Status:</label>
                        <select onchange="updateStatus('${id}', this.value)" style="width:auto; display:inline-block; margin-left:10px;">
                            <option value="Pending" ${o.status==='Pending'?'selected':''}>Pending</option>
                            <option value="Approved" ${o.status==='Approved'?'selected':''}>Approved</option>
                            <option value="Rejected" ${o.status==='Rejected'?'selected':''}>Rejected</option>
                        </select>
                    </div>
                </div>`;
        });
    });

    window.updateStatus = (id, status) => update(ref(db, `orders/${id}`), { status: status });

    // --- PRODUCTS TAB ---
    
    // 1. Helper: Add "Package" Row
    window.addAdminPackageInput = () => {
        const container = document.getElementById('adm-package-list');
        const div = document.createElement('div');
        div.className = 'pkg-row';
        div.innerHTML = `
            <input type="text" placeholder="Name (e.g. 100 Gems)" class="pkg-name" style="flex:2;">
            <input type="number" placeholder="Price" class="pkg-price" style="flex:1;">
            <button onclick="this.parentElement.remove()" class="btn btn-danger btn-sm">✕</button>
        `;
        container.appendChild(div);
    };

    // 2. Helper: Add "Custom Field" Row
    window.addAdminFieldInput = () => {
        const container = document.getElementById('adm-custom-fields-list');
        const div = document.createElement('div');
        div.className = 'field-row';
        div.innerHTML = `
            <input type="text" placeholder="Field Label (e.g. Player ID)" class="admin-c-field">
            <button onclick="this.parentElement.remove()" class="btn btn-danger btn-sm">✕</button>
        `;
        container.appendChild(div);
    };

    // Load Categories for Select
    onValue(ref(db, 'categories'), snap => {
        const s = document.getElementById('p-cat');
        s.innerHTML = '';
        Object.entries(snap.val() || {}).forEach(([id, c]) => s.innerHTML += `<option value="${id}">${c.name}</option>`);
    });

    // Load Products List
    onValue(ref(db, 'products'), (snap) => {
        const prodList = document.getElementById('adm-prod-list');
        prodList.innerHTML = '';
        Object.entries(snap.val() || {}).forEach(([id, p]) => {
            prodList.innerHTML += `
                <li style="display:flex; justify-content:space-between; align-items:center; padding:10px; border-bottom:1px solid #eee;">
                    <div>
                        <strong>${p.name}</strong><br>
                        <small style="color:#666">${p.variants ? p.variants.length + ' Packages' : 'Single Price'}</small>
                    </div>
                    <button onclick="del('products/${id}')" class="btn-danger btn-sm">Delete</button>
                </li>`;
        });
    });

    // Add Product Logic
    window.addProduct = () => {
        const name = document.getElementById('p-name').value;
        const img = document.getElementById('p-img-link').value;
        const cat = document.getElementById('p-cat').value;
        const desc = document.getElementById('p-desc').value;
        
        // Gather Custom Fields
        const customFields = Array.from(document.querySelectorAll('.admin-c-field'))
            .map(input => input.value.trim())
            .filter(val => val !== "");

        // Gather Packages
        const variants = [];
        document.querySelectorAll('.pkg-row').forEach(row => {
            const pkgName = row.querySelector('.pkg-name').value.trim();
            const pkgPrice = row.querySelector('.pkg-price').value.trim();
            if(pkgName && pkgPrice) {
                variants.push({ name: pkgName, price: Number(pkgPrice) });
            }
        });

        if(!name || !img) return alert("Name and Image are required.");
        if(variants.length === 0) return alert("Please add at least one Package/Variant.");

        // Store lowest price for display
        const minPrice = Math.min(...variants.map(v => v.price));

        push(ref(db, 'products'), { 
            name, 
            price: minPrice, 
            variants, 
            image: img, 
            category: cat, 
            description: desc, 
            customFields 
        });
        
        alert('Product Added!');
        window.location.reload(); 
    };

    // --- CATEGORIES TAB ---
    onValue(ref(db, 'categories'), (snap) => {
        const catList = document.getElementById('adm-cat-list');
        catList.innerHTML = '';
        Object.entries(snap.val() || {}).forEach(([id, c]) => {
            catList.innerHTML += `<li>${c.name} <button onclick="del('categories/${id}')" class="btn-danger btn-sm" style="margin-left:10px">Del</button></li>`;
        });
    });

    window.addCategory = () => {
        const name = document.getElementById('cat-name').value;
        if(name) push(ref(db, 'categories'), { name: name });
    };

        // --- PAYMENT METHODS TAB ---

    // 1. Render Existing Methods (With Delete Button)
    onValue(ref(db, 'paymentMethods'), (snap) => {
        const list = document.getElementById('adm-pay-list');
        if(list) {
            list.innerHTML = '';
            const methods = snap.val() || {};
            
            if (Object.keys(methods).length === 0) {
                list.innerHTML = '<p style="color:#888;">No payment methods added yet.</p>';
            }

            Object.entries(methods).forEach(([id, m]) => {
                list.innerHTML += `
                    <li style="background:white; border:1px solid #eee; padding:15px; margin-bottom:10px; border-radius:8px; display:flex; justify-content:space-between; align-items:center; box-shadow:0 2px 5px rgba(0,0,0,0.02);">
                        <div style="display:flex; align-items:center; gap:15px;">
                            ${m.image ? 
                                `<img src="${m.image}" style="width:50px; height:50px; object-fit:contain; border:1px solid #ddd; border-radius:4px; background:#fff;">` 
                                : '<div style="width:50px; height:50px; background:#f0f0f0; border-radius:4px; display:flex; align-items:center; justify-content:center; font-size:0.7rem; color:#888;">No Img</div>'}
                            <div>
                                <strong style="font-size:1rem; display:block;">${m.name}</strong>
                                <small style="color:#666;">${m.instructions.substring(0, 25)}...</small>
                            </div>
                        </div>
                        <button onclick="del('paymentMethods/${id}')" class="btn btn-danger btn-sm" style="padding:8px 12px;">Delete</button>
                    </li>
                `;
            });
        }
    });

    // 2. Add New Method Logic
    window.addPayment = async () => {
        const name = document.getElementById('pay-name').value;
        const instr = document.getElementById('pay-instr').value;
        const fileInput = document.getElementById('pay-img-file');
        const btn = document.querySelector('#sec-pay button'); // Select the Add button

        if(!name || !instr) return alert("Name and Instructions are required");
        
        let imageUrl = "";
        
        // Handle Image Upload
        if(fileInput.files.length > 0) {
            btn.textContent = "Uploading Image...";
            btn.disabled = true;
            imageUrl = await uploadImage(fileInput.files[0]);
            
            if(!imageUrl) {
                btn.disabled = false;
                btn.textContent = "Add Method";
                return alert("Image upload failed");
            }
        }

        // Push to Firebase
        push(ref(db, 'paymentMethods'), { 
            name: name, 
            instructions: instr,
            image: imageUrl
        });
        
        // Reset UI
        alert("Payment Method Added Successfully");
        document.getElementById('pay-name').value = '';
        document.getElementById('pay-instr').value = '';
        document.getElementById('pay-img-file').value = '';
        btn.disabled = false;
        btn.textContent = "Add Method";

    };


