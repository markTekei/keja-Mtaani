"use strict";

// Use the SAME Supabase project values as script.js.
// Never put a service-role or secret key in this file.
const SUPABASE_URL = "https://mlbunltzvoouegcstdso.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable__i327Y-mupX-jdXXCvvDSw_pCis9B3E";

const loginPanel = document.getElementById("login-panel");
const dashboardPanel = document.getElementById("dashboard-panel");
const loginForm = document.getElementById("login-form");
const logoutButton = document.getElementById("logout-button");
const pageMessage = document.getElementById("page-message");
const dashboardMessage = document.getElementById("dashboard-message");
const adminList = document.getElementById("admin-list");
const statusFilter = document.getElementById("status-filter");

let client = null;
let currentUser = null;
let loadingListings = false;

function setPageMessage(message) {
  pageMessage.textContent = message;
}

function setDashboardMessage(message) {
  dashboardMessage.textContent = message;
}

function showLogin() {
  loginPanel.classList.remove("hidden");
  dashboardPanel.classList.add("hidden");
  logoutButton.classList.add("hidden");
}

function showDashboard() {
  loginPanel.classList.add("hidden");
  dashboardPanel.classList.remove("hidden");
  logoutButton.classList.remove("hidden");
}

function isAdmin(user) {
  return user &&
    user.app_metadata &&
    user.app_metadata.role === "admin";
}

function makeTextElement(tag, text, className) {
  const element = document.createElement(tag);
  element.textContent = text || "";
  if (className) element.className = className;
  return element;
}

function makeHouseCard(house) {
  const card = document.createElement("article");
  card.className = "admin-card";

  if (house.image_url &&
      house.image_url.startsWith("https://")) {
    const image = document.createElement("img");
    image.src = house.image_url;
    image.alt = house.title || "House photo";
    image.loading = "lazy";
    card.appendChild(image);
  }

  const content = document.createElement("div");
  content.className = "admin-card-content";

  content.appendChild(makeTextElement("h3", house.title));
  content.appendChild(makeTextElement("p", "Area: " + house.area));
  content.appendChild(makeTextElement(
    "p",
    "Rent: KSh " + Number(house.rent).toLocaleString("en-KE") + " / month"
  ));
  content.appendChild(makeTextElement("p", "Type: " + house.house_type));
  content.appendChild(makeTextElement(
    "p", house.description || "No description supplied."
  ));
  content.appendChild(makeTextElement(
    "p", "Contact: " + (house.contact_phone || "Not supplied")
  ));
  content.appendChild(makeTextElement(
    "p", "Status: " + house.status, "status-label"
  ));

  const actions = document.createElement("div");
  actions.className = "admin-actions";

  if (house.status !== "approved") {
    const approveButton = document.createElement("button");
    approveButton.type = "button";
    approveButton.className = "button";
    approveButton.textContent = "Approve";
    approveButton.addEventListener("click", function () {
      changeStatus(house.id, "approved");
    });
    actions.appendChild(approveButton);
  }

  if (house.status !== "rejected") {
    const rejectButton = document.createElement("button");
    rejectButton.type = "button";
    rejectButton.className = "button reject-button";
    rejectButton.textContent = "Reject";
    rejectButton.addEventListener("click", function () {
      changeStatus(house.id, "rejected");
    });
    actions.appendChild(rejectButton);
  }

  if (house.status !== "pending") {
    const pendingButton = document.createElement("button");
    pendingButton.type = "button";
    pendingButton.className = "button";
    pendingButton.textContent = "Return to pending";
    pendingButton.addEventListener("click", function () {
      changeStatus(house.id, "pending");
    });
    actions.appendChild(pendingButton);
  }

  content.appendChild(actions);
  card.appendChild(content);
  return card;
}

async function loadListings() {
  if (!client || !currentUser || !isAdmin(currentUser)) return;
  if (loadingListings) return;

  loadingListings = true;
  adminList.replaceChildren();
  setDashboardMessage("Loading listings...");

  try {
    const selectedStatus = statusFilter.value;

    let query = client
      .from("houses")
      .select(
        "id, title, area, rent, house_type, description, image_url, contact_phone, status, created_at"
      )
      .order("created_at", { ascending: false });

    if (selectedStatus !== "all") {
      query = query.eq("status", selectedStatus);
    }

    const { data, error } = await query;

    if (error) {
      console.error("Could not load listings:", error);
      setDashboardMessage(
        "Could not load listings. Check the database policies and admin role."
      );
      return;
    }

    if (!data || data.length === 0) {
      setDashboardMessage("No listings found for this status.");
      return;
    }

    setDashboardMessage(data.length + " listing(s) found.");

    data.forEach(function (house) {
      adminList.appendChild(makeHouseCard(house));
    });
  } catch (error) {
    console.error(error);
    setDashboardMessage("An unexpected error occurred while loading listings.");
  } finally {
    loadingListings = false;
  }
}

async function changeStatus(houseId, newStatus) {
  if (!client || !currentUser || !isAdmin(currentUser)) {
    setPageMessage("Administrator access is required.");
    return;
  }

  const confirmation = newStatus === "approved"
    ? "Approve this house and make it visible on the public website?"
    : newStatus === "rejected"
      ? "Reject this house listing?"
      : "Return this listing to pending review?";

  if (!window.confirm(confirmation)) return;

  setDashboardMessage("Updating listing...");

  const { error } = await client
    .from("houses")
    .update({ status: newStatus })
    .eq("id", houseId);

  if (error) {
    console.error("Status update failed:", error);
    setDashboardMessage(
      "Update failed. Check your admin role, login session, and database policies."
    );
    return;
  }

  setDashboardMessage("Listing status updated.");
  await loadListings();
}

async function checkSession() {
  const { data, error } = await client.auth.getSession();

  if (error) {
    setPageMessage("Could not check your login session.");
    return;
  }

  const user = data.session ? data.session.user : null;
  await handleUser(user);
}

async function handleUser(user) {
  currentUser = user;

  if (!user) {
    showLogin();
    setPageMessage("Sign in with your administrator account.");
    return;
  }

  if (!isAdmin(user)) {
    showLogin();
    setPageMessage(
      "This account is not an administrator. Sign out and use the authorized admin account."
    );
    await client.auth.signOut();
    currentUser = null;
    return;
  }

  setPageMessage("");
  showDashboard();
  await loadListings();
}

async function startDashboard() {
  if (!window.supabase) {
    setPageMessage("Supabase library failed to load. Check your internet connection.");
    return;
  }

  if (
    SUPABASE_URL.includes("PASTE_YOUR") ||
    SUPABASE_PUBLISHABLE_KEY.includes("PASTE_YOUR")
  ) {
    setPageMessage("Add your Supabase URL and publishable key in admin.js.");
    return;
  }

  client = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_PUBLISHABLE_KEY
  );

  loginForm.addEventListener("submit", async function (event) {
    event.preventDefault();
    setPageMessage("Signing in...");

    const email = document.getElementById("admin-email").value.trim();
    const password = document.getElementById("admin-password").value;

    const { data, error } = await client.auth.signInWithPassword({
      email: email,
      password: password
    });

    if (error) {
      console.error("Sign-in failed:", error);
      setPageMessage("Sign-in failed. Check your email and password.");
      return;
    }

    await handleUser(data.user);
  });

  logoutButton.addEventListener("click", async function () {
    const { error } = await client.auth.signOut();

    if (error) {
      setPageMessage("Sign-out failed. Please try again.");
      return;
    }

    currentUser = null;
    adminList.replaceChildren();
    showLogin();
    setPageMessage("You have signed out.");
  });

  statusFilter.addEventListener("change", loadListings);

  client.auth.onAuthStateChange(function (_event, session) {
    // Defer work until the auth callback finishes.
    setTimeout(function () {
      handleUser(session ? session.user : null);
    }, 0);
  });

  await checkSession();
}

startDashboard();