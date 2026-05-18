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

// Menu DOM Elements
const btnMenu = document.getElementById("btnMenu");
const dropdownMenu = document.getElementById("dropdownMenu");
const menuLinkCatalog = document.getElementById("menuLinkCatalog");
const menuLinkAdmin = document.getElementById("menuLinkAdmin");
const menuLinkLogin = document.getElementById("menuLinkLogin");
const menuLinkLogout = document.getElementById("menuLinkLogout");

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

// Elementos del DOM (Modal de Edición)
const editProductModal = document.getElementById("editProductModal");
const closeEditModal = document.getElementById("closeEditModal");
const editProductForm = document.getElementById("editProductForm");
const inputEditProductId = document.getElementById("editProductId");
const inputEditNombre = document.getElementById("editNombre");
const inputEditDescripcion = document.getElementById("editDescripcion");
const inputEditPrecio = document.getElementById("editPrecio");
const inputEditPrecioOferta = document.getElementById("editPrecioOferta");
const inputEditAgotado = document.getElementById("editAgotado");
const btnEditSubmit = document.getElementById("btnEditSubmit");

// Variables globales
let activeProducts = [];
let selectedFiles = [];

// Inicializar la aplicación
document.addEventListener("DOMContentLoaded", () => {
  if (typeof lucide !== "undefined") {
    lucide.createIcons();
  }

  // Prevenir que el scroll cambie los valores de los inputs tipo number
  document.addEventListener("wheel", (e) => {
    if (document.activeElement && document.activeElement.type === "number") {
      document.activeElement.blur();
    }
  });

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY || SUPABASE_URL.includes("TU_SUPABASE_URL")) {
    showToast("Por favor, configura las credenciales de Supabase en config.js", "error");
    if (adminLoader) adminLoader.style.display = "none";
    if (adminEmptyState) adminEmptyState.style.display = "block";
    return;
  }

  setupEventListeners();
  setupAuthStateListener();
});

// Configurar el listener de estado de autenticación de Supabase
function setupAuthStateListener() {
  if (!supabaseClient) return;
  // Comprobar la sesión actual y escuchar cambios de estado
  supabaseClient.auth.onAuthStateChange((event, session) => {
    const isOwner = !!(session && session.user);
    
    if (isOwner) {
      // Usuario autenticado como dueño
      if (loginSection) loginSection.style.display = "none";
      if (adminSection) adminSection.style.display = "block";
      
      // Ajustar visibilidades en el menú dropdown
      if (menuLinkAdmin) menuLinkAdmin.style.display = "flex";
      if (menuLinkLogout) menuLinkLogout.style.display = "flex";
      if (menuLinkLogin) menuLinkLogin.style.display = "none";
      
      loadAdminProducts();
    } else {
      // Usuario no autenticado (o no es el dueño)
      if (loginSection) loginSection.style.display = "block";
      if (adminSection) adminSection.style.display = "none";
      
      // Ajustar visibilidades en el menú dropdown
      if (menuLinkAdmin) menuLinkAdmin.style.display = "none";
      if (menuLinkLogout) menuLinkLogout.style.display = "none";
      if (menuLinkLogin) menuLinkLogin.style.display = "flex";
    }
    
    if (typeof lucide !== "undefined") {
      lucide.createIcons();
    }
  });
}

// Configurar los listeners de eventos de UI
function setupEventListeners() {
  // Previsualizar las fotos seleccionadas (múltiples)
  if (inputFoto) {
    inputFoto.addEventListener("change", () => {
      selectedFiles = Array.from(inputFoto.files);
      renderPreviews();
    });
  }

  // Guardar/Publicar el formulario de producto
  if (productForm) {
    productForm.addEventListener("submit", handleFormSubmit);
  }

  // Procesar inicio de sesión
  if (loginForm) {
    loginForm.addEventListener("submit", handleLoginSubmit);
  }

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

  // Cerrar sesión desde el menú dropdown
  if (menuLinkLogout) {
    menuLinkLogout.addEventListener("click", handleLogout);
  }

  // Modal de edición - Cerrar
  if (closeEditModal) {
    closeEditModal.addEventListener("click", () => {
      if (editProductModal) editProductModal.style.display = "none";
    });
  }

  if (editProductModal) {
    editProductModal.addEventListener("click", (e) => {
      if (e.target === editProductModal) {
        editProductModal.style.display = "none";
      }
    });
  }

  // Procesar guardado de edición
  if (editProductForm) {
    editProductForm.addEventListener("submit", handleEditFormSubmit);
  }
}

// Renderizar las miniaturas de previsualización
function renderPreviews() {
  if (!previewGrid) return;
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
  if (btnLoginSubmit) {
    btnLoginSubmit.disabled = true;
    btnLoginSubmit.innerHTML = `<i data-lucide="loader" class="animate-spin" style="width: 18px; height: 18px; margin-right: 8px;"></i> Ingresando...`;
  }
  if (typeof lucide !== "undefined") lucide.createIcons();

  try {
    const { data, error } = await supabaseClient.auth.signInWithPassword({
      email: email,
      password: password
    });

    if (error) throw error;

    showToast("¡Bienvenido de nuevo, Administrador!", "success");
    if (loginForm) loginForm.reset();
  } catch (error) {
    console.error("Error al iniciar sesión:", error);
    showToast("Credenciales inválidas o correo no registrado.", "error");
  } finally {
    if (btnLoginSubmit) {
      btnLoginSubmit.disabled = false;
      btnLoginSubmit.innerHTML = `<i data-lucide="log-in" style="width: 18px; height: 18px;"></i> Ingresar al Panel`;
    }
    if (typeof lucide !== "undefined") lucide.createIcons();
  }
}

// Procesar el cierre de sesión local
async function handleLogout(e) {
  if (e) e.preventDefault();
  if (dropdownMenu) dropdownMenu.classList.remove("active");
  try {
    // Cerramos sesión únicamente en el dispositivo local
    const { error } = await supabaseClient.auth.signOut({ scope: 'local' });
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
    if (adminLoader) adminLoader.style.display = "flex";
    if (adminList) adminList.style.display = "none";
    if (adminEmptyState) adminEmptyState.style.display = "none";

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
    if (adminLoader) adminLoader.style.display = "none";
    if (adminEmptyState) adminEmptyState.style.display = "block";
  }
}

// Renderizar la lista de productos con controles de administrador
function renderAdminProducts(items) {
  if (adminLoader) adminLoader.style.display = "none";

  if (items.length === 0) {
    if (adminList) adminList.style.display = "none";
    if (adminEmptyState) adminEmptyState.style.display = "block";
    return;
  }

  if (adminEmptyState) adminEmptyState.style.display = "none";
  if (adminList) {
    adminList.innerHTML = "";
    adminList.style.display = "flex";
  }

  items.forEach(product => {
    const fallbackImage = "https://images.unsplash.com/photo-1541807084-5c52b6b3adef?q=80&w=600&auto=format&fit=crop";
    let imageUrl = fallbackImage;
    if (product.imagenes && product.imagenes.length > 0) {
      imageUrl = product.imagenes[0];
    } else if (product.imagen_url) {
      imageUrl = product.imagen_url;
    }

    const hasDiscount = product.precio_oferta && Number(product.precio_oferta) > 0;
    const isOut = product.agotado === true;

    let statusBadgesHTML = '';
    if (isOut) {
      statusBadgesHTML += `<span style="background: #FC8181; color: white; font-size: 0.75rem; padding: 0.1rem 0.4rem; border-radius: var(--radius-sm); font-family: var(--font-varsity); margin-left: 0.5rem;">AGOTADO</span>`;
    }
    if (hasDiscount) {
      statusBadgesHTML += `<span style="background: var(--color-accent); color: var(--color-secondary); font-size: 0.75rem; padding: 0.1rem 0.4rem; border-radius: var(--radius-sm); font-family: var(--font-varsity); margin-left: 0.5rem;">OFERTA</span>`;
    }

    let priceDisplayHTML = '';
    if (hasDiscount) {
      priceDisplayHTML = `
        <span style="text-decoration: line-through; color: var(--color-text-light); font-size: 0.85rem; margin-right: 0.4rem;">${formatPrice(product.precio)}</span>
        <span style="color: #FC8181; font-weight: 700;">${formatPrice(product.precio_oferta)}</span>
      `;
    } else {
      priceDisplayHTML = `<span class="admin-list-price">${formatPrice(product.precio)}</span>`;
    }

    const listItem = document.createElement("div");
    listItem.className = "admin-list-item";
    
    const allUrls = product.imagenes ? product.imagenes.join(",") : (product.imagen_url || "");
    
    listItem.innerHTML = `
      <img src="${imageUrl}" alt="${product.nombre}" class="admin-list-img" style="${isOut ? 'filter: grayscale(0.5);' : ''}">
      <div class="admin-list-info">
        <h4 class="admin-list-title" style="display: flex; align-items: center; flex-wrap: wrap; gap: 0.25rem;">
          ${product.nombre}
          ${statusBadgesHTML}
        </h4>
        <div style="margin-top: 0.25rem;">
          ${priceDisplayHTML}
        </div>
      </div>
      <div class="admin-list-actions" style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
        <button class="btn btn-secondary btn-edit" style="background: var(--color-primary); color: white; border: none; padding: 0.5rem 0.8rem; font-size: 0.85rem; border-radius: var(--radius-sm); display: flex; align-items: center; gap: 4px; cursor: pointer;">
          <i data-lucide="edit-3" style="width: 14px; height: 14px;"></i>
          Editar
        </button>
        <button class="btn btn-danger btn-delete" data-id="${product.id}" data-urls="${allUrls}" aria-label="Eliminar publicación">
          <i data-lucide="trash-2" style="width: 14px; height: 14px;"></i>
          Eliminar
        </button>
      </div>
    `;

    // Asignar evento al botón editar
    const editBtn = listItem.querySelector(".btn-edit");
    if (editBtn) {
      editBtn.addEventListener("click", () => {
        openEditModal(product);
      });
    }

    // Asignar evento al botón eliminar
    const deleteBtn = listItem.querySelector(".btn-delete");
    if (deleteBtn) {
      deleteBtn.addEventListener("click", () => {
        const id = deleteBtn.getAttribute("data-id");
        const urlsString = deleteBtn.getAttribute("data-urls");
        const urls = urlsString ? urlsString.split(",") : [];
        handleDeleteProduct(id, urls);
      });
    }

    if (adminList) adminList.appendChild(listItem);
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
  if (btnSubmit) {
    btnSubmit.disabled = true;
    btnSubmit.innerHTML = `<i data-lucide="loader" class="animate-spin" style="width: 20px; height: 20px;"></i> Subiendo...`;
  }
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
          precio_oferta: null,
          agotado: false,
          imagen_url: imageUrls[0], // Guardamos la primera como fallback
          imagenes: imageUrls       // Guardamos todas en el array
        }
      ]);

    if (error) throw error;

    showToast("¡Camiseta publicada con éxito!", "success");
    
    // Resetear formulario
    if (productForm) productForm.reset();
    selectedFiles = [];
    if (previewGrid) previewGrid.innerHTML = "";
    
    // Recargar lista de productos
    loadAdminProducts();
  } catch (error) {
    console.error("Error al publicar casaca:", error);
    showToast("Hubo un error al publicar la camiseta. Revisa el storage y la conexión.", "error");
  } finally {
    // Rehabilitar botón
    if (btnSubmit) {
      btnSubmit.disabled = false;
      btnSubmit.innerHTML = `<i data-lucide="plus-circle" style="width: 20px; height: 20px;"></i> Publicar Camiseta`;
    }
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

// Abrir el Modal de Edición con los valores actuales del producto
function openEditModal(product) {
  if (!editProductModal) return;

  // Llenar campos
  if (inputEditProductId) inputEditProductId.value = product.id;
  if (inputEditNombre) inputEditNombre.value = product.nombre || "";
  if (inputEditDescripcion) inputEditDescripcion.value = product.descripcion || "";
  if (inputEditPrecio) inputEditPrecio.value = product.precio || 0;
  if (inputEditPrecioOferta) inputEditPrecioOferta.value = product.precio_oferta || "";
  if (inputEditAgotado) inputEditAgotado.checked = product.agotado === true;

  // Mostrar modal
  editProductModal.style.display = "flex";

  if (typeof lucide !== "undefined") {
    lucide.createIcons();
  }
}

// Procesar el envío del formulario de edición
async function handleEditFormSubmit(e) {
  e.preventDefault();

  const id = inputEditProductId.value;
  const nombre = inputEditNombre.value.trim();
  const descripcion = inputEditDescripcion.value.trim();
  const precio = parseFloat(inputEditPrecio.value);
  const precioOfertaVal = inputEditPrecioOferta.value.trim();
  const precio_oferta = precioOfertaVal ? parseFloat(precioOfertaVal) : null;
  const agotado = inputEditAgotado.checked;

  if (!id || !nombre || !descripcion || isNaN(precio)) {
    showToast("Por favor, completa todos los campos requeridos.", "error");
    return;
  }

  // Deshabilitar botón
  if (btnEditSubmit) {
    btnEditSubmit.disabled = true;
    btnEditSubmit.innerHTML = `<i data-lucide="loader" class="animate-spin" style="width: 20px; height: 20px; margin-right: 8px;"></i> Guardando...`;
  }
  if (typeof lucide !== "undefined") lucide.createIcons();

  try {
    // Actualizar registro en Supabase
    const { error } = await supabaseClient
      .from("productos")
      .update({
        nombre,
        descripcion,
        precio,
        precio_oferta,
        agotado
      })
      .eq("id", id);

    if (error) throw error;

    showToast("¡Camiseta actualizada con éxito!", "success");

    // Cerrar modal
    if (editProductModal) editProductModal.style.display = "none";

    // Recargar productos
    loadAdminProducts();
  } catch (error) {
    console.error("Error al actualizar casaca:", error);
    showToast("Hubo un error al actualizar la camiseta.", "error");
  } finally {
    // Rehabilitar botón
    if (btnEditSubmit) {
      btnEditSubmit.disabled = false;
      btnEditSubmit.innerHTML = `<i data-lucide="save" style="width: 20px; height: 20px;"></i> Guardar Cambios`;
    }
    if (typeof lucide !== "undefined") lucide.createIcons();
  }
}
