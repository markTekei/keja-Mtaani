"use strict";

// 1. Paste your Supabase Project URL here.
const SUPABASE_URL = "https://mlbunltzvoouegcstdso.supabase.co";

// 2. Paste your Supabase publishable key here.
// It should begin with sb_publishable_.
// NEVER put a secret/service-role key here.
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable__i327Y-mupX-jdXXCvvDSw_pCis9B3E";

const messageElement = document.getElementById("listing-message");
const houseListElement = document.getElementById("house-list");
const searchForm = document.getElementById("search-form");

let allHouses = [];
let supabaseClient = null;

document.getElementById("current-year").textContent =
  new Date().getFullYear();

function showMessage(message) {
  messageElement.textContent = message;
}

function formatRent(rent) {
  return "KSh " + Number(rent).toLocaleString("en-KE") + " / month";
}

function createHouseCard(house) {
  const card = document.createElement("article");
  card.className = "house-card";

  // Only load images from HTTPS URLs.
  if (house.image_url &&
      house.image_url.startsWith("https://")) {
    const image = document.createElement("img");
    image.src = house.image_url;
    image.alt = house.title;
    image.loading = "lazy";
    image.className = "house-image";
    card.appendChild(image);
  }

  const content = document.createElement("div");
  content.className = "house-content";

  const title = document.createElement("h3");
  title.textContent = house.title;

  const location = document.createElement("p");
  location.className = "house-location";
  location.textContent = "📍 " + house.area;

  const rent = document.createElement("p");
  rent.className = "house-rent";
  rent.textContent = formatRent(house.rent);

  const type = document.createElement("p");
  type.textContent = "Type: " + house.house_type;

  const description = document.createElement("p");
  description.textContent = house.description || "Contact us for details.";

  content.append(title, location, rent, type, description);

  // Contact number is optional. No phone number is invented.
  const phone = String(house.contact_phone || "").replace(/\D/g, "");

  if (phone) {
    const contactLink = document.createElement("a");
    contactLink.className = "button";
    contactLink.textContent = "Enquire on WhatsApp";
    contactLink.href =
      "https://wa.me/" + phone +
      "?text=" + encodeURIComponent(
        "Hello, I am enquiring about " + house.title +
        " in " + house.area + ". Is it available?"
      );
    contactLink.target = "_blank";
    contactLink.rel = "noopener noreferrer";
    content.appendChild(contactLink);
  }

  card.appendChild(content);
  return card;
}

function renderHouses(houses) {
  houseListElement.replaceChildren();

  if (houses.length === 0) {
    showMessage(
      allHouses.length === 0
        ? "No approved houses are listed yet. Please check again later."
        : "No houses match your search. Try changing your filters."
    );
    return;
  }

  showMessage(
    houses.length + (houses.length === 1
      ? " approved house found."
      : " approved houses found.")
  );

  houses.forEach(function (house) {
    houseListElement.appendChild(createHouseCard(house));
  });
}

function applyFilters() {
  const selectedArea =
    document.getElementById("area-filter").value.toLowerCase();

  const maxRentInput =
    document.getElementById("rent-filter").value;

  const maxRent = maxRentInput === ""
    ? null
    : Number(maxRentInput);

  const selectedType =
    document.getElementById("type-filter").value.toLowerCase();

  const filteredHouses = allHouses.filter(function (house) {
    const matchesArea =
      !selectedArea || house.area.toLowerCase() === selectedArea;

    const matchesRent =
      maxRent === null || Number(house.rent) <= maxRent;

    const matchesType =
      !selectedType || house.house_type.toLowerCase() === selectedType;

    return matchesArea && matchesRent && matchesType;
  });

  renderHouses(filteredHouses);
}

async function loadHouses() {
  showMessage("Loading approved houses...");
  houseListElement.replaceChildren();

  if (!window.supabase) {
    showMessage("The database library did not load. Check your internet connection.");
    return;
  }

  if (
    SUPABASE_URL.includes("PASTE_YOUR") ||
    SUPABASE_PUBLISHABLE_KEY.includes("PASTE_YOUR")
  ) {
    showMessage("Add your Supabase Project URL and publishable key in script.js.");
    return;
  }

  try {
    supabaseClient = window.supabase.createClient(
      SUPABASE_URL,
      SUPABASE_PUBLISHABLE_KEY
    );

    const { data, error } = await supabaseClient
      .from("houses")
      .select(
        "id, title, area, rent, house_type, description, image_url, contact_phone"
      )
      .eq("status", "approved")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Supabase listing error:", error);
      showMessage(
        "We could not load houses. Check your database table, key, and security policies."
      );
      return;
    }

    allHouses = data || [];
    applyFilters();
  } catch (error) {
    console.error("Unexpected loading error:", error);
    showMessage("Something went wrong while loading houses. Please try again.");
  }
}

searchForm.addEventListener("submit", function (event) {
  event.preventDefault();
  applyFilters();
});

document.getElementById("reset-search").addEventListener("click", function () {
  searchForm.reset();
  applyFilters();
});

loadHouses();