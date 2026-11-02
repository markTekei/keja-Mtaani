"use strict";

// Supabase project settings
const SUPABASE_URL = "https://mlbunltzvoouegcstdso.supabase.co";
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

  if (house.photo_url &&
      house.photo_url.startsWith("https://")) {
    const image = document.createElement("img");
    image.src = house.photo_url;
    image.alt = house.title;
    image.loading = "lazy";
    image.className = "house-image";

    image.onerror = function () {
      image.remove();
    };

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
  description.textContent =
    house.description || "Contact us for details.";

  content.append(title, location, rent, type, description);

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
    houses.length +
    (houses.length === 1
      ? " approved house found."
      : " approved houses found.")
  );

  houses.forEach(function (house) {
    houseListElement.appendChild(createHouseCard(house));
  });
}

function normalizeFilterValue(value) {
  return String(value || "").trim().toLowerCase().replace(/\s+/g, " ");
}

function normalizeArea(area) {
  const normalizedArea = normalizeFilterValue(area);
  return normalizedArea === "kitusuri" ? "kitisuru" : normalizedArea;
}

function normalizeHouseType(type) {
  const normalizedType = normalizeFilterValue(type);

  if (normalizedType === "single") {
    return "single room";
  }

  if (normalizedType === "1 bedroom") {
    return "one bedroom";
  }

  return normalizedType;
}

function applyFilters() {
  const selectedArea =
    normalizeArea(document.getElementById("area-filter").value);

  const maxRentInput =
    document.getElementById("rent-filter").value;

  const maxRent = maxRentInput === ""
    ? null
    : Number(maxRentInput);

  const selectedType =
    normalizeHouseType(document.getElementById("type-filter").value);

  const filteredHouses = allHouses.filter(function (house) {
    const matchesArea =
      !selectedArea || normalizeArea(house.area) === selectedArea;

    const matchesRent =
      maxRent === null || Number(house.rent) <= maxRent;

    const matchesType =
      !selectedType ||
      normalizeHouseType(house.house_type) === selectedType;

    return matchesArea && matchesRent && matchesType;
  });

  renderHouses(filteredHouses);
}

async function loadHouses() {
  showMessage("Loading approved houses...");
  houseListElement.replaceChildren();

  if (!window.supabase) {
    showMessage(
      "The database library did not load. Check your internet connection."
    );
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
      console.error("Error loading houses:", error);
      showMessage("We could not load houses. Please try again.");
      return;
    }

    const housesWithPhotos = await Promise.all(
      (data || []).map(async function (house) {
        const imageUrl = house.image_url || "";

        if (!imageUrl) {
          return { ...house, photo_url: "" };
        }

        // Existing Unsplash images are already full URLs.
        if (imageUrl.startsWith("https://images.unsplash.com/")) {
          return { ...house, photo_url: imageUrl };
        }

        // Handle an existing full Supabase Storage URL.
        const storageMarker = "/storage/v1/object/";
        const markerIndex = imageUrl.indexOf(storageMarker);

        let storagePath = imageUrl;

        if (markerIndex !== -1) {
          let objectPart = imageUrl.substring(
            markerIndex + storageMarker.length
          );

          // Support public or signed object URL formats.
          objectPart = objectPart.replace(
            /^(public|sign|authenticated)\//,
            ""
          );

          const bucketMarker = "house-photos/";
          const bucketIndex = objectPart.indexOf(bucketMarker);

          if (bucketIndex === -1) {
            console.warn("Unrecognized photo URL:", imageUrl);
            return { ...house, photo_url: "" };
          }

          storagePath = objectPart.substring(
            bucketIndex + bucketMarker.length
          );

          // Remove query parameters from stored URLs.
          storagePath = storagePath.split("?")[0];
        }

        const { data: photoData, error: photoError } =
          await supabaseClient.storage
            .from("house-photos")
            .createSignedUrl(storagePath, 3600);

        if (photoError || !photoData?.signedUrl) {
          console.warn(
            "Could not create photo URL for:",
            house.title,
            photoError
          );

          return { ...house, photo_url: "" };
        }

        return {
          ...house,
          photo_url: photoData.signedUrl
        };
      })
    );

    allHouses = housesWithPhotos;
    applyFilters();

  } catch (error) {
    console.error("Unexpected loading error:", error);
    showMessage(
      "Something went wrong while loading houses. Please try again."
    );
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