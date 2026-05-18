// Inicialización de Supabase
let supabaseClient;

try {
  supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
} catch (error) {
  console.error("Error al inicializar Supabase client:", error);
}

// Elementos del DOM (Autenticación)
const loginSection = document.getElementById("loginSection");
const adminSection = document.getElementById("adminSection");
const loginForm = document.getElementById("loginForm");
const inputLoginEmail = document.getElementById("loginEmail");
const inputLoginPassword = document.getElementById("loginPassword");
const btnLoginSubmit = document.getElementById("btnLoginSubmit");
const btnLogout = document.getElementById("btnLogout");

// Elementos del DOM (Administración de productos)
const productForm = document.getElementById("productForm");
const inputNombre = document.getElementById("nombre");
const inputDescripcion = document.getElementById("descripcion");
const inputPrecio = document.getElementById("precio");
const inputFoto = document.getElementById("foto");
const previewGrid = document.getElementById("previewGrid");
const btnSubmit = document.getElementById("btnSubmit");

const adminLoader = document.getElementById("adminLoader");
const adminEmptyState = document.getElementById("adminEmptyState");
const adminList = document.getElementById("adminList");
const toastContainer = document.getElementById("toastContainer");

// Variables globales
let activeProducts = [];
let selectedFiles = [];

// Inicializar la aplicación
document.addEventListener("DOMContentLoaded", () => {
  if (typeof lucide !== "undefined") {
    lucide.createIcons();
  }

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY || SUPABASE_URL.includes("TU_SUPABASE_URL")) {
    showToast("Por favor, configura las credenciales de Supabase en config.js", "error");
    adminLoader.style.display = "none";
    adminEmptyState.style.display = "block";
    return;
  }

  setupEventListeners();
  setupAuthStateListener();
});

// Configurar el listener de estado de autenticación de Supabase
function setupAuthStateListener() {
  // Comprobar la sesión actual y escuchar cambios de estado
  supabaseClient.auth.onAuthStateChange((event, session) => {
    if (session) {
      // Usuario autenticado
      loginSection.style.display = "none";
      adminSection.style.display = "block";
      btnLogout.style.display = "inline-block";
      loadAdminProducts();
    } else {
      // Usuario no autenticado
      loginSection.style.display = "block";
      adminSection.style.display = "none";
      btnLogout.style.display = "none";
    }
    
    if (typeof lucide !== "undefined") {
      lucide.createIcons();
    }
  });
}

// Configurar los listeners de eventos de UI
function setupEventListeners() {
  // Previsualizar las fotos seleccionadas (múltiples)
  inputFoto.addEventListener("change", () => {
    selectedFiles = Array.from(inputFoto.files);
    renderPreviews();
  });

  // Guardar/Publicar el formulario de producto
  productForm.addEventListener("submit", handleFormSubmit);

  // Procesar inicio de sesión
  loginForm.addEventListener("submit", handleLoginSubmit);

  // Cerrar sesión
  btnLogout.addEventListener("click", handleLogout);
}

// Renderizar las miniaturas de previsualización
function renderPreviews() {
  previewGrid.innerHTML = "";
  if (selectedFiles.length === 0) return;
  
  selectedFiles.forEach((file, index) => {
    if (file.size > 5 * 1024 * 1024) {
      showToast(`La imagen "${file.name}" supera los 5MB y no será incluida.`, "error");
      selectedFiles.splice(index, 1);
      return;
    }
    
    const reader = new FileReader();
    reader.onload = (e) => {
      const item = document.createElement("div");
      item.className = "preview-item";
      item.innerHTML = `
        <img src="${e.target.result}" alt="Preview ${index + 1}">
        <button type="button" class="preview-item-remove" data-index="${index}">&times;</button>
      `;
      
      item.querySelector(".preview-item-remove").addEventListener("click", (evt) => {
        evt.stopPropagation();
        selectedFiles.splice(index, 1);
        renderPreviews();
      });
      
      previewGrid.appendChild(item);
    };
    reader.readAsDataURL(file);
  });
}

// Procesar el inicio de sesión
async function handleLoginSubmit(e) {
  e.preventDefault();
  const email = inputLoginEmail.value.trim();
  const password = inputLoginPassword.value;

  if (!email || !password) {
    showToast("Por favor ingresa tu correo y contraseña.", "error");
    return;
  }

  // Deshabilitar botón
  btnLoginSubmit.disabled = true;
  btnLoginSubmit.innerHTML = `<i data-lucide="loader" class="animate-spin" style="width: 18px; height: 18px; margin-right: 8px;"></i> Ingresando...`;
  if (typeof lucide !== "undefined") lucide.createIcons();

  try {
    const { data, error } = await supabaseClient.auth.signInWithPassword({
      email: email,
      password: password
    });

    if (error) throw error;

    showToast("¡Bienvenido de nuevo, Administrador!", "success");
    loginForm.reset();
  } catch (error) {
    console.error("Error al iniciar sesión:", error);
    showToast("Credenciales inválidas o correo no registrado.", "error");
  } finally {
    btnLoginSubmit.disabled = false;
    btnLoginSubmit.innerHTML = `<i data-lucide="log-in" style="width: 18px; height: 18px;"></i> Ingresar al Panel`;
    if (typeof lucide !== "undefined") lucide.createIcons();
  }
}

// Procesar el cierre de sesión
async function handleLogout(e) {
  e.preventDefault();
  try {
    const { error } = await supabaseClient.auth.signOut();
    if (error) throw error;
    showToast("Has cerrado sesión correctamente.", "success");
  } catch (error) {
    console.error("Error al cerrar sesión:", error);
    showToast("Hubo un error al cerrar la sesión.", "error");
  }
}

// Cargar todas las publicaciones en la lista de gestión
async function loadAdminProducts() {
  try {
    adminLoader.style.display = "flex";
    adminList.style.display = "none";
    adminEmptyState.style.display = "none";

    const { data, error } = await supabaseClient
      .from("productos")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) throw error;

    activeProducts = data || [];
    renderAdminProducts(activeProducts);
  } catch (error) {
    console.error("Error al cargar administrador:", error);
    showToast("No se pudo cargar la lista de gestión", "error");
    adminLoader.style.display = "none";
    adminEmptyState.style.display = "block";
  }
}

// Renderizar la lista de productos con controles de administrador
function renderAdminProducts(items) {
  adminLoader.style.display = "none";

  if (items.length === 0) {
    adminList.style.display = "none";
    adminEmptyState.style.display = "block";
    return;
  }

  adminEmptyState.style.display = "none";
  adminList.innerHTML = "";
  adminList.style.display = "flex";

  items.forEach(product => {
    const fallbackImage = "https://images.unsplash.com/photo-1541807084-5c52b6b3adef?q=80&w=600&auto=format&fit=crop";
    let imageUrl = fallbackImage;
    if (product.imagenes && product.imagenes.length > 0) {
      imageUrl = product.imagenes[0];
    } else if (product.imagen_url) {
      imageUrl = product.imagen_url;
    }

    const listItem = document.createElement("div");
    listItem.className = "admin-list-item";
    
    const allUrls = product.imagenes ? product.imagenes.join(",") : (product.imagen_url || "");
    
    listItem.innerHTML = `
      <img src="${imageUrl}" alt="${product.nombre}" class="admin-list-img">
      <div class="admin-list-info">
        <h4 class="admin-list-title">${product.nombre}</h4>
        <span class="admin-list-price">${formatPrice(product.precio)}</span>
      </div>
      <button class="btn btn-danger btn-delete" data-id="${product.id}" data-urls="${allUrls}" aria-label="Eliminar publicación">
        <i data-lucide="trash-2" style="width: 16px; height: 16px; margin-right: 4px;"></i>
        Eliminar
      </button>
    `;

    // Asignar evento al botón eliminar
    const deleteBtn = listItem.querySelector(".btn-delete");
    deleteBtn.addEventListener("click", () => {
      const id = deleteBtn.getAttribute("data-id");
      const urlsString = deleteBtn.getAttribute("data-urls");
      const urls = urlsString ? urlsString.split(",") : [];
      handleDeleteProduct(id, urls);
    });

    adminList.appendChild(listItem);
  });

  if (typeof lucide !== "undefined") {
    lucide.createIcons();
  }
}

// Subir imagen al Bucket y obtener su URL pública
async function uploadProductImage(file) {
  const fileExt = file.name.split(".").pop();
  const uniqueName = `${Math.random().toString(36).substring(2, 15)}_${Date.now()}.${fileExt}`;
  const filePath = `uploads/${uniqueName}`;

  // Subir el archivo
  const { data, error } = await supabaseClient.storage
    .from("camisetas-images")
    .upload(filePath, file);

  if (error) throw error;

  // Obtener URL Pública
  const { data: publicUrlData } = supabaseClient.storage
    .from("camisetas-images")
    .getPublicUrl(filePath);

  return publicUrlData.publicUrl;
}

// Procesar el envío del formulario de creación
async function handleFormSubmit(e) {
  e.preventDefault();
  
  const nombre = inputNombre.value.trim();
  const descripcion = inputDescripcion.value.trim();
  const precio = parseFloat(inputPrecio.value);

  if (!nombre || !descripcion || isNaN(precio)) {
    showToast("Por favor, completa todos los campos requeridos.", "error");
    return;
  }

  if (selectedFiles.length === 0) {
    showToast("Por favor, selecciona al menos una foto para la casaca.", "error");
    return;
  }

  // Deshabilitar botón y cambiar texto
  btnSubmit.disabled = true;
  btnSubmit.innerHTML = `<i data-lucide="loader" class="animate-spin" style="width: 20px; height: 20px;"></i> Subiendo...`;
  if (typeof lucide !== "undefined") lucide.createIcons();

  try {
    // 1. Subir todas las imágenes al storage
    const uploadPromises = selectedFiles.map(file => uploadProductImage(file));
    const imageUrls = await Promise.all(uploadPromises);

    // 2. Insertar el registro en la base de datos
    const { data, error } = await supabaseClient
      .from("productos")
      .insert([
        {
          nombre,
          descripcion,
          precio,
          imagen_url: imageUrls[0], // Guardamos la primera como fallback
          imagenes: imageUrls       // Guardamos todas en el array
        }
      ]);

    if (error) throw error;

    showToast("¡Camiseta publicada con éxito!", "success");
    
    // Resetear formulario
    productForm.reset();
    selectedFiles = [];
    previewGrid.innerHTML = "";
    
    // Recargar lista de productos
    loadAdminProducts();
  } catch (error) {
    console.error("Error al publicar casaca:", error);
    showToast("Hubo un error al publicar la camiseta. Revisa el storage y la conexión.", "error");
  } finally {
    // Rehabilitar botón
    btnSubmit.disabled = false;
    btnSubmit.innerHTML = `<i data-lucide="plus-circle" style="width: 20px; height: 20px;"></i> Publicar Camiseta`;
    if (typeof lucide !== "undefined") lucide.createIcons();
  }
}

// Procesar la eliminación de un producto
async function handleDeleteProduct(productId, imageUrls) {
  const confirmDelete = confirm("¿Estás seguro de que deseas eliminar esta camiseta del catálogo?");
  if (!confirmDelete) return;

  try {
    // 1. Eliminar de la base de datos
    const { error: dbError } = await supabaseClient
      .from("productos")
      .delete()
      .eq("id", productId);

    if (dbError) throw dbError;

    // 2. Eliminar del Bucket de Storage todas las imágenes asociadas
    if (imageUrls && imageUrls.length > 0) {
      const removePromises = imageUrls.map(async (imageUrl) => {
        if (imageUrl && imageUrl.includes("camisetas-images")) {
          try {
            const parts = imageUrl.split("camisetas-images/");
            if (parts.length > 1) {
              const filePath = decodeURIComponent(parts[1]);
              await supabaseClient.storage
                .from("camisetas-images")
                .remove([filePath]);
            }
          } catch (storageErr) {
            console.warn("Error al extraer ruta de archivo para eliminar:", storageErr);
          }
        }
      });
      await Promise.all(removePromises);
    }

    showToast("La publicación se eliminó correctamente.", "success");
    loadAdminProducts();
  } catch (error) {
    console.error("Error al eliminar:", error);
    showToast("No se pudo eliminar la publicación.", "error");
  }
}

// Formatear precios
function formatPrice(value) {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    minimumFractionDigits: 0
  }).format(value);
}

// Mostrar notificaciones Toast
function showToast(message, type = "success") {
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
