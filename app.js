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

// Menu DOM Elements
const btnMenu = document.getElementById("btnMenu");
const dropdownMenu = document.getElementById("dropdownMenu");
const menuLinkCatalog = document.getElementById("menuLinkCatalog");
const menuLinkAdmin = document.getElementById("menuLinkAdmin");
const menuLinkLogin = document.getElementById("menuLinkLogin");
const menuLinkLogout = document.getElementById("menuLinkLogout");

// Variables globales
let products = [];
const WHATSAPP_NUMBER = "5492615987368";

// Lista de correos autorizados para el panel de administración
const ALLOWED_ADMIN_EMAILS = ["maximocirrin@gmail.com", "fabricirrin@hotmail.com"];

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
  
  loadProducts();
  setupEventListeners();
  checkAuthStatus();
});

// verificar estado de autenticación para mostrar/ocultar secciones en el menú
async function checkAuthStatus() {
  if (!supabaseClient) return;
  try {
    const { data: { session } } = await supabaseClient.auth.getSession();
    const isOwner = session && session.user && session.user.email && ALLOWED_ADMIN_EMAILS.includes(session.user.email.toLowerCase().trim());
    
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
}

// Cargar productos desde Supabase
async function loadProducts() {
  try {
    const { data, error } = await supabaseClient
      .from("productos")
      .select("*")
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

    const message = `¡Hola FC Casacas! 👋 Me interesa la camiseta *${product.nombre}* (${formatPrice(product.precio)}). ¿La tienen disponible?`;
    const encodedText = encodeURIComponent(message);
    const waUrl = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodedText}`;

    card.innerHTML = `
      <div class="product-image-wrap">
        <img src="${imageUrl}" alt="${product.nombre}" loading="lazy">
      </div>
      <div class="product-info">
        <h3 class="product-title">${product.nombre}</h3>
        <p class="product-price">${formatPrice(product.precio)}</p>
        <a href="${waUrl}" target="_blank" class="btn btn-whatsapp card-buy-btn" style="margin-top: 1rem; width: 100%; display: flex; align-items: center; justify-content: center; gap: 8px;">
          <i data-lucide="shopping-bag" style="width: 18px; height: 18px;"></i>
          Comprar por WhatsApp
        </a>
      </div>
    `;

    // Click event para abrir modal
    card.addEventListener("click", () => openModal(product));

    // Detener la propagación para evitar abrir el modal al hacer clic en el botón
    const buyBtn = card.querySelector(".card-buy-btn");
    if (buyBtn) {
      buyBtn.addEventListener("click", (e) => {
        e.stopPropagation();
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
  if (modalTitle) modalTitle.textContent = product.nombre;
  if (modalPrice) modalPrice.textContent = formatPrice(product.precio);
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
  
  setupModalCarousel(images, product.nombre);

  // Generar link de WhatsApp
  const message = `¡Hola FC Casacas! 👋 Me interesa la camiseta *${product.nombre}* (${formatPrice(product.precio)}). ¿La tienen disponible?`;
  const encodedText = encodeURIComponent(message);
  if (btnBuy) btnBuy.href = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodedText}`;

  if (productModal) productModal.classList.add("active");
  document.body.style.overflow = "hidden"; // Deshabilita scroll de fondo
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
