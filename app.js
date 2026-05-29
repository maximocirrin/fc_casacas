// Inicialización de Supabase
let supabaseClient;

try {
  supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
} catch (error) {
  console.error("Error al inicializar Supabase client:", error);
}

// Elementos del DOM
const loader = document.getElementById("loader");
const emptyState = document.getElementById("emptyState");
const productsGrid = document.getElementById("productsGrid");
const productModal = document.getElementById("productModal");
const closeModalBtn = document.getElementById("closeModal");

const modalImageContainer = document.getElementById("modalImageContainer");
const modalTitle = document.getElementById("modalTitle");
const modalPrice = document.getElementById("modalPrice");
const modalDesc = document.getElementById("modalDesc");
const btnBuy = document.getElementById("btnBuy");
const toastContainer = document.getElementById("toastContainer");
const searchInput = document.getElementById("searchInput");

// Menu DOM Elements
const btnMenu = document.getElementById("btnMenu");
const dropdownMenu = document.getElementById("dropdownMenu");
const menuLinkCatalog = document.getElementById("menuLinkCatalog");
const menuLinkAdmin = document.getElementById("menuLinkAdmin");
const menuLinkLogin = document.getElementById("menuLinkLogin");
const menuLinkLogout = document.getElementById("menuLinkLogout");

// Cart DOM Elements
const btnCart = document.getElementById("btnCart");
const cartBadge = document.getElementById("cartBadge");
const cartDrawer = document.getElementById("cartDrawer");
const closeCartBtn = document.getElementById("closeCartBtn");
const cartItemsContainer = document.getElementById("cartItemsContainer");
const cartSubtotalValue = document.getElementById("cartSubtotalValue");
const btnCheckout = document.getElementById("btnCheckout");

// Variables globales
let products = [];
let cart = [];
const WHATSAPP_NUMBER = "5492615987368";

// Inicializar la aplicación
document.addEventListener("DOMContentLoaded", () => {
  if (typeof lucide !== "undefined") {
    lucide.createIcons();
  }
  
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY || SUPABASE_URL.includes("TU_SUPABASE_URL")) {
    showToast("Por favor, configura las credenciales de Supabase en config.js", "error");
    if (loader) loader.style.display = "none";
    if (emptyState) emptyState.style.display = "block";
    return;
  }
  
  initCart();
  loadProducts();
  setupEventListeners();
  checkAuthStatus();
});

// verificar estado de autenticación para mostrar/ocultar secciones en el menú
async function checkAuthStatus() {
  if (!supabaseClient) return;
  try {
    const { data: { session } } = await supabaseClient.auth.getSession();
    const isOwner = !!(session && session.user);
    
    if (isOwner) {
      if (menuLinkAdmin) menuLinkAdmin.style.display = "flex";
      if (menuLinkLogout) menuLinkLogout.style.display = "flex";
      if (menuLinkLogin) menuLinkLogin.style.display = "none";
    } else {
      if (menuLinkAdmin) menuLinkAdmin.style.display = "none";
      if (menuLinkLogout) menuLinkLogout.style.display = "none";
      if (menuLinkLogin) menuLinkLogin.style.display = "flex";
    }
  } catch (err) {
    console.error("Error comprobando autenticación:", err);
  }
}

// Configurar los listeners
function setupEventListeners() {
  // Cerrar modal al hacer clic en el botón de cerrar
  if (closeModalBtn) {
    closeModalBtn.addEventListener("click", closeModal);
  }
  
  // Cerrar modal al hacer clic fuera del contenido
  if (productModal) {
    productModal.addEventListener("click", (e) => {
      if (e.target === productModal) {
        closeModal();
      }
    });
  }

  // Cerrar modal con la tecla Esc
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && productModal && productModal.classList.contains("active")) {
      closeModal();
    }
  });

  // Toggling del dropdown de menú premium
  if (btnMenu && dropdownMenu) {
    btnMenu.addEventListener("click", (e) => {
      e.stopPropagation();
      dropdownMenu.classList.toggle("active");
    });

    document.addEventListener("click", (e) => {
      if (!dropdownMenu.contains(e.target) && e.target !== btnMenu && !btnMenu.contains(e.target)) {
        dropdownMenu.classList.remove("active");
      }
    });
  }

  // Logout desde el menú dropdown (con scope local para no cerrar sesión en otros dispositivos)
  if (menuLinkLogout) {
    menuLinkLogout.addEventListener("click", async (e) => {
      e.preventDefault();
      dropdownMenu.classList.remove("active");
      try {
        const { error } = await supabaseClient.auth.signOut({ scope: 'local' });
        if (error) throw error;
        showToast("Sesión cerrada con éxito", "success");
        checkAuthStatus();
      } catch (err) {
        console.error("Error al cerrar sesión:", err);
        showToast("Error al cerrar sesión", "error");
      }
    });
  }

  // --- Listeners del Carrito ---
  if (btnCart && cartDrawer) {
    btnCart.addEventListener("click", (e) => {
      e.stopPropagation();
      cartDrawer.classList.add("active");
      document.body.style.overflow = "hidden"; // Deshabilita scroll de fondo
    });
  }

  if (closeCartBtn && cartDrawer) {
    closeCartBtn.addEventListener("click", () => {
      cartDrawer.classList.remove("active");
      document.body.style.overflow = ""; // Reactiva scroll de fondo
    });
  }

  if (cartDrawer) {
    cartDrawer.addEventListener("click", (e) => {
      if (e.target === cartDrawer) {
        cartDrawer.classList.remove("active");
        document.body.style.overflow = "";
      }
    });
  }

  if (btnCheckout) {
    btnCheckout.addEventListener("click", () => {
      checkoutCart();
    });
  }

  // --- Buscador ---
  if (searchInput) {
    searchInput.addEventListener("input", (e) => {
      const term = e.target.value.toLowerCase();
      const filtered = products.filter(p => 
        p.nombre.toLowerCase().includes(term) || 
        (p.descripcion && p.descripcion.toLowerCase().includes(term))
      );
      renderProducts(filtered);
    });
  }
}

// Cargar productos desde Supabase
async function loadProducts() {
  try {
    const { data, error } = await supabaseClient
      .from("productos")
      .select("*")
      .order("orden", { ascending: true })
      .order("created_at", { ascending: false });

    if (error) throw error;

    products = data || [];
    renderProducts(products);
  } catch (error) {
    console.error("Error cargando productos:", error);
    showToast("No se pudieron cargar las casacas. Intente nuevamente.", "error");
    if (loader) loader.style.display = "none";
    if (emptyState) emptyState.style.display = "block";
  }
}

function getOptimizedImageUrl(url, width = 800) {
  if (!url) return 'https://via.placeholder.com/800x800.png?text=Sin+Imagen';
  return url;
}

// Renderizar las tarjetas de productos
function renderProducts(items) {
  if (loader) loader.style.display = "none";
  
  if (items.length === 0) {
    if (productsGrid) productsGrid.style.display = "none";
    if (emptyState) emptyState.style.display = "block";
    return;
  }

  if (emptyState) emptyState.style.display = "none";
  if (productsGrid) {
    productsGrid.innerHTML = "";
    productsGrid.style.display = "grid";
  }

  items.forEach(product => {
    const card = document.createElement("div");
    card.className = "product-card";
    card.setAttribute("role", "button");
    card.setAttribute("tabindex", "0");
    
    // Imagen de fallback por si la URL es inválida
    const fallbackImage = "https://images.unsplash.com/photo-1541807084-5c52b6b3adef?q=80&w=600&auto=format&fit=crop";
    let imageUrl = fallbackImage;
    if (product.imagenes && product.imagenes.length > 0) {
      imageUrl = product.imagenes[0];
    } else if (product.imagen_url) {
      imageUrl = product.imagen_url;
    }
    imageUrl = getOptimizedImageUrl(imageUrl, 800);

    const hasDiscount = product.precio_oferta && Number(product.precio_oferta) > 0;
    const isOut = product.agotado === true;
    const finalPrice = hasDiscount ? product.precio_oferta : product.precio;

    let badgeHTML = '';
    if (isOut) {
      badgeHTML = `<span class="product-badge badge-agotado">AGOTADO</span>`;
    } else if (hasDiscount) {
      badgeHTML = `<span class="product-badge badge-oferta">OFERTA</span>`;
    }

    let priceHTML = '';
    if (hasDiscount) {
      priceHTML = `
        <span class="price-regular line-through">${formatPrice(product.precio)}</span>
        <span class="price-offer">${formatPrice(product.precio_oferta)}</span>
      `;
    } else {
      priceHTML = `<span class="price-regular">${formatPrice(product.precio)}</span>`;
    }

    let buyBtnHTML = '';
    if (isOut) {
      buyBtnHTML = `
        <button disabled class="btn btn-disabled card-buy-btn" style="margin-top: 1rem; width: 100%; display: flex; align-items: center; justify-content: center; gap: 8px;">
          <i data-lucide="slash" style="width: 18px; height: 18px;"></i>
          Sin Stock / Agotado
        </button>
      `;
    } else {
      const message = `¡Hola Casacas FC! 👋 Me interesa la camiseta *${product.nombre}* (${formatPrice(finalPrice)}). ¿La tienen disponible?`;
      const encodedText = encodeURIComponent(message);
      const waUrl = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodedText}`;
      buyBtnHTML = `
        <div class="card-actions-wrapper" style="margin-top: 1rem; display: grid; grid-template-columns: 1fr 1fr; gap: 0.5rem; width: 100%;">
          <a href="${waUrl}" target="_blank" class="btn btn-whatsapp card-buy-btn" style="width: 100%; display: flex; align-items: center; justify-content: center; gap: 6px; padding: 0.6rem 0.4rem; font-size: 0.8rem; font-weight: 700;">
            <i data-lucide="shopping-bag" style="width: 14px; height: 14px;"></i>
            Comprar
          </a>
          <button class="btn btn-accent card-add-cart-btn" data-id="${product.id}" style="width: 100%; display: flex; align-items: center; justify-content: center; gap: 6px; padding: 0.6rem 0.4rem; font-size: 0.8rem; font-weight: 700; background: var(--color-primary); color: white; border: none; cursor: pointer; border-radius: var(--radius-sm); transition: var(--transition);">
            <i data-lucide="shopping-cart" style="width: 14px; height: 14px;"></i>
            + Carrito
          </button>
        </div>
      `;
    }

    card.innerHTML = `
      <div class="product-image-wrap" style="${isOut ? 'filter: grayscale(0.4) opacity(0.85);' : ''}">
        ${badgeHTML}
        <img src="${imageUrl}" alt="${product.nombre}" loading="lazy">
      </div>
      <div class="product-info">
        <h3 class="product-title">${product.nombre}</h3>
        <p class="product-price">${priceHTML}</p>
        ${buyBtnHTML}
      </div>
    `;

    // Click event para abrir modal
    card.addEventListener("click", () => openModal(product));

    // Detener la propagación para evitar abrir el modal al hacer clic en el botón de WhatsApp
    const buyBtn = card.querySelector(".card-buy-btn");
    if (buyBtn) {
      buyBtn.addEventListener("click", (e) => {
        e.stopPropagation();
      });
    }

    // Detener propagación y agregar al carrito al hacer clic en + Carrito
    const addCartBtn = card.querySelector(".card-add-cart-btn");
    if (addCartBtn) {
      addCartBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        addToCart(product);
      });
    }
    
    // Soporte para accesibilidad de teclado
    card.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        openModal(product);
      }
    });

    if (productsGrid) productsGrid.appendChild(card);
  });

  if (typeof lucide !== "undefined") {
    lucide.createIcons();
  }
}

// Abrir el Modal de detalles del producto
function openModal(product) {
  const hasDiscount = product.precio_oferta && Number(product.precio_oferta) > 0;
  const isOut = product.agotado === true;
  const finalPrice = hasDiscount ? product.precio_oferta : product.precio;

  if (modalTitle) {
    if (isOut) {
      modalTitle.innerHTML = `${product.nombre} <span style="background: #FC8181; color: white; font-size: 0.85rem; padding: 0.25rem 0.5rem; border-radius: var(--radius-sm); margin-left: 0.5rem; font-family: var(--font-varsity);">AGOTADO</span>`;
    } else {
      modalTitle.textContent = product.nombre;
    }
  }

  if (modalPrice) {
    if (hasDiscount) {
      modalPrice.innerHTML = `
        <span style="text-decoration: line-through; color: var(--color-text-light); font-size: 1.2rem; font-weight: 500; margin-right: 0.5rem;">${formatPrice(product.precio)}</span>
        <span style="color: #FC8181; font-weight: 800;">${formatPrice(product.precio_oferta)}</span>
      `;
    } else {
      modalPrice.textContent = formatPrice(product.precio);
    }
  }

  if (modalDesc) modalDesc.textContent = product.descripcion || "Sin descripción disponible.";

  // Configurar carrusel de imágenes
  let images = [];
  if (product.imagenes && product.imagenes.length > 0) {
    images = product.imagenes;
  } else if (product.imagen_url) {
    images = [product.imagen_url];
  } else {
    images = ["https://images.unsplash.com/photo-1541807084-5c52b6b3adef?q=80&w=600&auto=format&fit=crop"];
  }
  
  setupModalCarousel(images.map(img => getOptimizedImageUrl(img, 1000)), product.nombre);

  // Configurar botones de acción en Modal
  const modalActionsContainer = document.getElementById("modalActionsContainer");
  if (modalActionsContainer) {
    if (isOut) {
      modalActionsContainer.innerHTML = `
        <button disabled class="btn btn-disabled" style="width: 100%; display: flex; align-items: center; justify-content: center; gap: 8px; padding: 1rem;">
          <i data-lucide="slash" style="width: 20px; height: 20px;"></i>
          Agotado / Sin Stock
        </button>
      `;
    } else {
      const message = `¡Hola Casacas FC! 👋 Me interesa la camiseta *${product.nombre}* (${formatPrice(finalPrice)}). ¿La tienen disponible?`;
      const encodedText = encodeURIComponent(message);
      const waUrl = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodedText}`;
      modalActionsContainer.innerHTML = `
        <div style="display: grid; grid-template-columns: 1.2fr 1fr; gap: 1rem; width: 100%;">
          <a href="${waUrl}" target="_blank" class="btn btn-whatsapp" style="display: flex; align-items: center; justify-content: center; gap: 8px; padding: 1rem; font-weight: 700;">
            <i data-lucide="shopping-bag" style="width: 20px; height: 20px;"></i>
            Comprar WhatsApp
          </a>
          <button class="btn btn-accent modal-add-cart-btn" style="display: flex; align-items: center; justify-content: center; gap: 8px; padding: 1rem; background: var(--color-primary); color: white; border: none; border-radius: var(--radius-sm); cursor: pointer; transition: var(--transition); font-weight: 700;">
            <i data-lucide="shopping-cart" style="width: 20px; height: 20px;"></i>
            + Carrito
          </button>
        </div>
      `;
      
      const modalAddCartBtn = modalActionsContainer.querySelector(".modal-add-cart-btn");
      if (modalAddCartBtn) {
        modalAddCartBtn.addEventListener("click", () => {
          addToCart(product);
          closeModal();
        });
      }
    }
  }

  if (productModal) productModal.classList.add("active");
  document.body.style.overflow = "hidden"; // Deshabilita scroll de fondo

  if (typeof lucide !== "undefined") {
    lucide.createIcons();
  }
}

// Configurar Carrusel interactivo dentro del modal
function setupModalCarousel(images, productName) {
  if (!modalImageContainer) return;
  modalImageContainer.innerHTML = "";
  
  const container = document.createElement("div");
  container.className = "carousel-container";
  
  // 1. Inyectar Imágenes
  images.forEach((imgUrl, index) => {
    const img = document.createElement("img");
    img.className = `carousel-slide ${index === 0 ? 'active' : ''}`;
    img.src = imgUrl;
    img.alt = `${productName} - Imagen ${index + 1}`;
    container.appendChild(img);
  });

  // 2. Si hay más de una imagen, inyectar flechas y puntos
  if (images.length > 1) {
    // Flecha Izquierda
    const prevBtn = document.createElement("button");
    prevBtn.className = "carousel-btn carousel-btn-prev";
    prevBtn.innerHTML = `<i data-lucide="chevron-left"></i>`;
    container.appendChild(prevBtn);

    // Flecha Derecha
    const nextBtn = document.createElement("button");
    nextBtn.className = "carousel-btn carousel-btn-next";
    nextBtn.innerHTML = `<i data-lucide="chevron-right"></i>`;
    container.appendChild(nextBtn);

    // Contenedor de Puntos
    const dotsContainer = document.createElement("div");
    dotsContainer.className = "carousel-dots";
    images.forEach((_, index) => {
      const dot = document.createElement("div");
      dot.className = `carousel-dot ${index === 0 ? 'active' : ''}`;
      dot.setAttribute("data-slide", index);
      dotsContainer.appendChild(dot);
    });
    container.appendChild(dotsContainer);

    modalImageContainer.appendChild(container);

    // Inicializar iconos de flecha
    if (typeof lucide !== "undefined") {
      lucide.createIcons();
    }

    // Lógica del carrusel
    let slideIndex = 0;
    const slides = container.querySelectorAll(".carousel-slide");
    const dots = container.querySelectorAll(".carousel-dot");

    function showSlide(index) {
      if (index >= slides.length) slideIndex = 0;
      else if (index < 0) slideIndex = slides.length - 1;
      else slideIndex = index;

      slides.forEach(s => s.classList.remove("active"));
      dots.forEach(d => d.classList.remove("active"));

      if (slides[slideIndex]) slides[slideIndex].classList.add("active");
      if (dots[slideIndex]) dots[slideIndex].classList.add("active");
    }

    prevBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      showSlide(slideIndex - 1);
    });
    nextBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      showSlide(slideIndex + 1);
    });
    
    dots.forEach(dot => {
      dot.addEventListener("click", (e) => {
        e.stopPropagation();
        const idx = parseInt(dot.getAttribute("data-slide"));
        showSlide(idx);
      });
    });
  } else {
    modalImageContainer.appendChild(container);
  }
}

// Cerrar el Modal
function closeModal() {
  if (productModal) productModal.classList.remove("active");
  document.body.style.overflow = ""; // Reactiva scroll
}

// Formatear precios a pesos argentinos (o dólares según la convención del negocio local)
function formatPrice(value) {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    minimumFractionDigits: 0
  }).format(value);
}

// Mostrar notificaciones Toast personalizadas
function showToast(message, type = "success") {
  if (!toastContainer) return;
  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  
  let iconName = "check-circle";
  if (type === "error") iconName = "alert-circle";
  
  toast.innerHTML = `
    <i data-lucide="${iconName}" style="margin-right: 0.5rem; width: 20px; height: 20px;"></i>
    <span>${message}</span>
  `;
  
  toastContainer.appendChild(toast);
  
  if (typeof lucide !== "undefined") {
    lucide.createIcons({
      attrs: {
        class: 'lucide-icon'
      },
      nameAttr: 'data-lucide'
    });
  }

  // Animación entrada
  setTimeout(() => {
    toast.classList.add("show");
  }, 10);

  // Auto eliminar
  setTimeout(() => {
    toast.classList.remove("show");
    setTimeout(() => {
      toast.remove();
    }, 300);
  }, 4000);
}

// --- FUNCIONES DEL CARRITO ---

// Inicializar el carrito
function initCart() {
  try {
    const savedCart = localStorage.getItem("fc_casacas_cart");
    if (savedCart) {
      cart = JSON.parse(savedCart);
    }
  } catch (error) {
    console.error("Error al cargar el carrito:", error);
    cart = [];
  }
  updateCartBadge();
  renderCart();
}

// Guardar carrito en localStorage y actualizar UI
function saveCart() {
  try {
    localStorage.setItem("fc_casacas_cart", JSON.stringify(cart));
  } catch (error) {
    console.error("Error al guardar el carrito:", error);
  }
  updateCartBadge();
  renderCart();
}

// Agregar producto al carrito
function addToCart(product) {
  if (product.agotado) {
    showToast("Esta camiseta está agotada y no se puede agregar al carrito.", "error");
    return;
  }

  const existingItem = cart.find(item => item.id === product.id);
  const price = product.precio_oferta && Number(product.precio_oferta) > 0 ? Number(product.precio_oferta) : Number(product.precio);
  
  // URL de la primera imagen
  const fallbackImage = "https://images.unsplash.com/photo-1541807084-5c52b6b3adef?q=80&w=600&auto=format&fit=crop";
  let imageUrl = fallbackImage;
  if (product.imagenes && product.imagenes.length > 0) {
    imageUrl = product.imagenes[0];
  } else if (product.imagen_url) {
    imageUrl = product.imagen_url;
  }
  imageUrl = getOptimizedImageUrl(imageUrl, 200);

  if (existingItem) {
    existingItem.cantidad += 1;
    showToast(`Se aumentó la cantidad de "${product.nombre}" en el carrito.`, "success");
  } else {
    cart.push({
      id: product.id,
      nombre: product.nombre,
      precio: price,
      imagen: imageUrl,
      cantidad: 1
    });
    showToast(`"${product.nombre}" agregado al carrito con éxito.`, "success");
  }

  saveCart();
  
  // Si Lucide está disponible
  if (typeof lucide !== "undefined") {
    lucide.createIcons();
  }
}

// Eliminar producto del carrito
function removeFromCart(productId) {
  const item = cart.find(item => item.id === productId);
  const itemName = item ? item.nombre : "Producto";
  cart = cart.filter(item => item.id !== productId);
  saveCart();
  showToast(`"${itemName}" eliminado del carrito.`, "success");
}

// Actualizar cantidad de producto en el carrito
function updateCartQty(productId, newQty) {
  if (newQty < 1) {
    removeFromCart(productId);
    return;
  }

  const item = cart.find(item => item.id === productId);
  if (item) {
    item.cantidad = newQty;
    saveCart();
  }
}

// Actualizar el badge flotante en la barra de navegación
function updateCartBadge() {
  if (!cartBadge) return;
  
  const totalCount = cart.reduce((sum, item) => sum + item.cantidad, 0);
  
  if (totalCount > 0) {
    cartBadge.textContent = totalCount;
    cartBadge.style.display = "flex";
  } else {
    cartBadge.style.display = "none";
  }
}

// Renderizar contenido de los items en el drawer del carrito
function renderCart() {
  if (!cartItemsContainer || !cartSubtotalValue) return;

  if (cart.length === 0) {
    cartItemsContainer.innerHTML = `
      <div class="cart-empty-state">
        <i data-lucide="shopping-cart" style="width: 48px; height: 48px; color: var(--color-text-light); stroke-width: 1.5;"></i>
        <h4 style="margin: 0; font-weight: 700; font-family: var(--font-graduate); color: var(--color-text);">Tu carrito está vacío</h4>
        <p style="margin: 0; color: var(--color-text-light);">¡Explora nuestro catálogo exclusivo y añade tus casacas favoritas!</p>
      </div>
    `;
    cartSubtotalValue.textContent = formatPrice(0);
    
    if (btnCheckout) {
      btnCheckout.setAttribute("disabled", "true");
      btnCheckout.style.pointerEvents = "none";
      btnCheckout.style.opacity = "0.6";
    }
    
    if (typeof lucide !== "undefined") {
      lucide.createIcons();
    }
    return;
  }

  if (btnCheckout) {
    btnCheckout.removeAttribute("disabled");
    btnCheckout.style.pointerEvents = "auto";
    btnCheckout.style.opacity = "1";
  }

  cartItemsContainer.innerHTML = "";
  let subtotal = 0;

  cart.forEach(item => {
    subtotal += item.precio * item.cantidad;
    
    const cartItemEl = document.createElement("div");
    cartItemEl.className = "cart-item";
    
    cartItemEl.innerHTML = `
      <img src="${item.imagen}" alt="${item.nombre}" class="cart-item-img">
      <div class="cart-item-details">
        <div>
          <div class="cart-item-name">${item.nombre}</div>
          <div class="cart-item-price">${formatPrice(item.precio)}</div>
        </div>
        <div class="cart-item-controls">
          <div class="cart-qty-selector">
            <button class="cart-qty-btn qty-minus" data-id="${item.id}">
              <i data-lucide="minus" style="width: 14px; height: 14px;"></i>
            </button>
            <span class="cart-qty-val">${item.cantidad}</span>
            <button class="cart-qty-btn qty-plus" data-id="${item.id}">
              <i data-lucide="plus" style="width: 14px; height: 14px;"></i>
            </button>
          </div>
          <button class="cart-item-remove" data-id="${item.id}" aria-label="Eliminar item">
            <i data-lucide="trash-2" style="width: 16px; height: 16px;"></i>
          </button>
        </div>
      </div>
    `;
    
    // Listeners para botones de control
    const minusBtn = cartItemEl.querySelector(".qty-minus");
    const plusBtn = cartItemEl.querySelector(".qty-plus");
    const removeBtn = cartItemEl.querySelector(".cart-item-remove");
    
    minusBtn.addEventListener("click", () => updateCartQty(item.id, item.cantidad - 1));
    plusBtn.addEventListener("click", () => updateCartQty(item.id, item.cantidad + 1));
    removeBtn.addEventListener("click", () => removeFromCart(item.id));
    
    cartItemsContainer.appendChild(cartItemEl);
  });

  cartSubtotalValue.textContent = formatPrice(subtotal);

  if (typeof lucide !== "undefined") {
    lucide.createIcons();
  }
}

// Finalizar la compra mandando al WhatsApp con un mensaje estructurado
function checkoutCart() {
  if (cart.length === 0) return;

  let message = `¡Hola Casacas FC! 👋 Me gustaría realizar un pedido con los siguientes artículos del catálogo:\n\n`;
  let total = 0;

  cart.forEach((item, index) => {
    const itemSubtotal = item.precio * item.cantidad;
    total += itemSubtotal;
    message += `${index + 1}. *${item.nombre}*\n`;
    message += `   Cantidad: ${item.cantidad}\n`;
    message += `   Precio unitario: ${formatPrice(item.precio)}\n`;
    message += `   Subtotal: ${formatPrice(itemSubtotal)}\n\n`;
  });

  message += `*Total del pedido: ${formatPrice(total)}*\n\n`;
  message += `¿Tienen stock disponible para coordinar el pago y el envío?`;

  const encodedText = encodeURIComponent(message);
  const waUrl = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodedText}`;

  // Abrir WhatsApp en pestaña nueva
  window.open(waUrl, "_blank");

  // Vaciar carrito tras la confirmación de checkout
  cart = [];
  saveCart();
  
  // Cerrar drawer
  if (cartDrawer) {
    cartDrawer.classList.remove("active");
    document.body.style.overflow = "";
  }
}
