(function() {
  const addView = document.getElementById("add-location-view");
  const addForm = document.getElementById("add-location-form");
  const encargadoSelect = document.getElementById("loc-encargado");
  const openAddBtn = document.getElementById("addLocationBtn"); // botón que abre modal
  const closeAddBtn = document.getElementById("close-modal-addlocation");

  // helper token
  function getToken() {
    return localStorage.getItem("token");
  }

  // abrir modal mostrando esta vista
  function openAddLocationModal() {
    // si tu modal global y funciones openModal() existen, puedes reutilizarlas.
    // Aquí simple toggle: mostrar modal y solo la vista de add location
    const modal = document.getElementById("modal");
    if (!modal) return;
    modal.style.display = "flex";
    modal.setAttribute("aria-hidden", "false");

    // esconder otras vistas (login/signup)
    document.getElementById("login-view")?.style.display = "none";
    document.getElementById("signup-view")?.style.display = "none";
    addView.style.display = "block";

    // cargar encargados al abrir
    loadEncargados();
    document.getElementById("loc-nombre").focus();
  }

  function closeModal() {
    const modal = document.getElementById("modal");
    if (!modal) return;
    modal.style.display = "none";
    modal.setAttribute("aria-hidden", "true");
    addForm.reset();
    encargadoSelect.innerHTML = '<option value="">-- Selecciona encargado --</option>';
  }

  // Traer encargados desde backend
  async function loadEncargados() {
    const token = getToken();
    if (!token) {
      console.warn("No token: no se cargarán encargados");
      return;
    }
    try {
      const res = await fetch("/api/encargados", {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) {
        console.error("No se pudieron obtener encargados");
        return;
      }
      const data = await res.json();
      encargadoSelect.innerHTML = '<option value="">-- Selecciona encargado --</option>';
      data.forEach(e => {
        const opt = document.createElement("option");
        opt.value = e.id;
        opt.textContent = e.nombre;
        encargadoSelect.appendChild(opt);
      });
    } catch (err) {
      console.error("loadEncargados error", err);
    }
  }

  // Enviar formulario
  addForm?.addEventListener("submit", async function(e) {
    e.preventDefault();
    const token = getToken();
    if (!token) {
      alert("Debes iniciar sesión para registrar una ubicación.");
      return;
    }

    // recoger valores
    const payload = {
      nombre: document.getElementById("loc-nombre").value.trim(),
      direccion: document.getElementById("loc-direccion").value.trim(),
      tipoestablecimiento: document.getElementById("loc-tipo").value,
      numextintores: Number.parseInt(document.getElementById("loc-numext").value || "0", 10),
      haybotiquin: document.querySelector('input[name="loc-botiquin"]:checked').value === "true",
      hayrociadores: document.querySelector('input[name="loc-rociadores"]:checked').value === "true",
      numemergenexits: Number.parseInt(document.getElementById("loc-numsalidas").value || "0", 10),
      ultimainspeccion: document.getElementById("loc-ultimainspeccion").value || null,
      idencargado: document.getElementById("loc-encargado").value || null
    };

    // Validaciones mínimas
    if (!payload.nombre || !payload.direccion || !payload.tipoestablecimiento) {
      alert("Por favor completa Nombre, Dirección y Tipo de establecimiento.");
      return;
    }

    try {
      const res = await fetch("/api/locations", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (res.ok || res.status === 201) {
        alert("✅ Ubicación registrada correctamente.");
        // opcional: refrescar el mapa o la lista de ubicaciones
        if (typeof window.refreshLocations === "function") {
          window.refreshLocations(); // si tienes una función que recarga ubicaciones
        }
        closeModal();
      } else {
        alert("❌ Error: " + (data.error || "No se pudo guardar la ubicación."));
      }
    } catch (err) {
      console.error("Error guardando ubicación:", err);
      alert("❌ Error de conexión al servidor.");
    }
  });

  // listeners para abrir/cerrar
  openAddBtn?.addEventListener("click", openAddLocationModal);
  closeAddBtn?.addEventListener("click", closeModal);

  // cerrar modal al click fuera (si usas el mismo #modal)
  const modalElem = document.getElementById("modal");
  modalElem?.addEventListener("click", (e) => {
    if (e.target === modalElem) closeModal();
  });

//Eliminar ubicación
document.getElementById("deleteLocationBtn").addEventListener("click", async () => {
  const locationId = window.currentLocationId; //este id lo asignas cuando abres un panel
  if (!locationId) return alert("No se encontró la ubicación.");
  
  const token = localStorage.getItem("token");
  if (!token) return alert("No estás autenticado.");
  
  if (!confirm("¿Seguro que quieres eliminar esta ubicación?")) return;
  
  const res = await fetch(`/api/locations/${locationId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` }
  });
  
  if (res.ok) {
    alert("Ubicación eliminada.");
    location.reload(); // refrescar mapa y lista
  } else {
    alert("Error al eliminar la ubicación.");
  }
});


})();