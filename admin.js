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
const searchInput = document.getElementById("listing-search");
const pendingCount = document.getElementById("pending-count");
const approvedCount = document.getElementById("approved-count");
const rejectedCount = document.getElementById("rejected-count");

let client = null;
let currentUser = null;
let loadingListings = false;
let allListings = [];

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
  adminList.replaceChildren();
  allListings = [];
  updateListingCounts([]);
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

async function getHousePhotoUrl(imageUrl, title) {
  if (!imageUrl) return "";

  if (imageUrl.startsWith("https://images.unsplash.com/")) {
    return imageUrl;
  }

  const storageMarker = "/storage/v1/object/";
  const markerIndex = imageUrl.indexOf(storageMarker);

  if (markerIndex === -1 && /^https:\/\//i.test(imageUrl)) {
    return imageUrl;
  }

  let storagePath = imageUrl;

  if (markerIndex !== -1) {
    let objectPart = imageUrl.substring(
      markerIndex + storageMarker.length
    );
    objectPart = objectPart.replace(
      /^(public|sign|authenticated)\//,
      ""
    );

    const bucketMarker = "house-photos/";
    const bucketIndex = objectPart.indexOf(bucketMarker);

    if (bucketIndex === -1) {
      console.warn("Unrecognized house photo URL:", imageUrl);
      return "";
    }

    storagePath = objectPart.substring(
      bucketIndex + bucketMarker.length
    ).split("?")[0];
  }

  const { data, error } = await client.storage
    .from("house-photos")
    .createSignedUrl(storagePath, 3600);

  if (error || !data?.signedUrl) {
    console.warn("Could not load photo for listing:", title, error);
    return "";
  }

  return data.signedUrl;
}

function makeHouseCard(house) {
  const card = document.createElement("article");
  card.className = "admin-card";

  if (house.photo_url) {
    const image = document.createElement("img");
    image.src = house.photo_url;
    image.alt = house.title || "House photo";
    image.loading = "lazy";
    image.onerror = function () {
      image.remove();
    };
    card.appendChild(image);
  } else {
    const imagePlaceholder = makeTextElement(
      "div",
      "No property photo provided",
      "admin-image-placeholder"
    );
    imagePlaceholder.setAttribute("aria-label", "No property photo provided");
    card.appendChild(imagePlaceholder);
  }

  const content = document.createElement("div");
  content.className = "admin-card-content";

  const cardHeading = document.createElement("div");
  cardHeading.className = "admin-card-heading";
  cardHeading.appendChild(makeTextElement("h3", house.title || "Untitled listing"));

  const status = makeTextElement("span", house.status || "unknown", "admin-status-badge");
  status.dataset.status = String(house.status || "").toLowerCase();
  cardHeading.appendChild(status);
  content.appendChild(cardHeading);

  const summary = document.createElement("div");
  summary.className = "admin-card-summary";
  summary.append(
    makeTextElement("span", house.area || "Area not supplied"),
    makeTextElement("span", house.house_type || "Type not supplied")
  );
  content.appendChild(summary);

  content.appendChild(makeTextElement(
    "p",
    "KSh " + Number(house.rent).toLocaleString("en-KE") + " / month",
    "admin-card-rent"
  ));
  content.appendChild(makeTextElement(
    "p",
    house.description || "No description supplied.",
    "admin-card-description"
  ));

  const details = document.createElement("div");
  details.className = "admin-card-details";
  details.appendChild(makeTextElement(
    "span",
    "WhatsApp: " + (house.contact_phone || "Not supplied")
  ));

  if (house.created_at) {
    const submittedAt = new Date(house.created_at);
    if (!Number.isNaN(submittedAt.getTime())) {
      details.appendChild(makeTextElement(
        "span",
        "Submitted " + submittedAt.toLocaleDateString("en-KE", {
          day: "numeric",
          month: "short",
          year: "numeric"
        })
      ));
    }
  }

  content.appendChild(details);

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
    const { data, error } = await client
      .from("houses")
      .select(
        "id, title, area, rent, house_type, description, image_url, contact_phone, status, created_at"
      )
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Could not load listings:", error);
      setDashboardMessage(
        "Could not load listings. Check the database policies and admin role."
      );
      return;
    }

    allListings = await Promise.all(
      (data || []).map(async function (house) {
        return {
          ...house,
          photo_url: await getHousePhotoUrl(house.image_url, house.title)
        };
      })
    );
    updateListingCounts(allListings);
    renderListings();
  } catch (error) {
    console.error(error);
    setDashboardMessage("An unexpected error occurred while loading listings.");
  } finally {
    loadingListings = false;
  }
}

function updateListingCounts(listings) {
  pendingCount.textContent = listings.filter(function (house) {
    return house.status === "pending";
  }).length;
  approvedCount.textContent = listings.filter(function (house) {
    return house.status === "approved";
  }).length;
  rejectedCount.textContent = listings.filter(function (house) {
    return house.status === "rejected";
  }).length;
}

function renderListings() {
  const selectedStatus = statusFilter.value;
  const searchTerm = searchInput.value.trim().toLowerCase();
  const filteredListings = allListings.filter(function (house) {
    const matchesStatus =
      selectedStatus === "all" || house.status === selectedStatus;
    const searchableText = [
      house.title,
      house.area,
      house.house_type,
      house.description,
      house.contact_phone
    ].join(" ").toLowerCase();
    return matchesStatus && (!searchTerm || searchableText.includes(searchTerm));
  });

  adminList.replaceChildren();

  if (filteredListings.length === 0) {
    setDashboardMessage(
      allListings.length === 0
        ? "No listings have been submitted yet."
        : "No listings match these filters. Try another search or status."
    );
    return;
  }

  setDashboardMessage(
    filteredListings.length +
    (filteredListings.length === 1 ? " listing shown." : " listings shown.")
  );

  filteredListings.forEach(function (house) {
    adminList.appendChild(makeHouseCard(house));
  });
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

  allListings = allListings.map(function (house) {
    return house.id === houseId
      ? { ...house, status: newStatus }
      : house;
  });
  updateListingCounts(allListings);
  renderListings();
  setPageMessage("Listing status updated.");
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

  statusFilter.addEventListener("change", renderListings);
  searchInput.addEventListener("input", renderListings);
  document.getElementById("refresh-listings").addEventListener(
    "click",
    loadListings
  );

  client.auth.onAuthStateChange(function (_event, session) {
    // Defer work until the auth callback finishes.
    setTimeout(function () {
      handleUser(session ? session.user : null);
    }, 0);
  });

  await checkSession();
}

startDashboard();