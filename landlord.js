"use strict";

const SUPABASE_URL = "https://mlbunltzvoouegcstdso.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable__i327Y-mupX-jdXXCvvDSw_pCis9B3E";

let client = null;

const pageMessage = document.getElementById("page-message");
const authPanel = document.getElementById("auth-panel");
const accountPanel = document.getElementById("account-panel");
const myHousesPanel = document.getElementById("my-houses-panel");
const authForm = document.getElementById("auth-form");
const houseForm = document.getElementById("house-form");
const myHouses = document.getElementById("my-houses");

let currentUser = null;
let submittingHouse = false;
let photoPreviewUrl = null;

document.getElementById("current-year").textContent =
  new Date().getFullYear();

function showMessage(message) {
  pageMessage.textContent = message;
}

function showSignedIn(user) {
  currentUser = user;
  authPanel.classList.add("hidden");
  accountPanel.classList.remove("hidden");
  myHousesPanel.classList.remove("hidden");

  document.getElementById("signed-in-as").textContent =
    "Signed in as " + user.email;

  loadMyHouses();
}

function showSignedOut() {
  currentUser = null;
  authPanel.classList.remove("hidden");
  accountPanel.classList.add("hidden");
  myHousesPanel.classList.add("hidden");
  myHouses.replaceChildren();
}

async function registerLandlord() {
  const email = document.getElementById("landlord-email").value.trim();
  const password = document.getElementById("landlord-password").value;

  showMessage("Creating your account...");

  const { data, error } = await client.auth.signUp({
    email,
    password
  });

  if (error) {
    showMessage("Registration failed: " + error.message);
    return;
  }

  if (data.session && data.user) {
    showSignedIn(data.user);
    showMessage("Account created successfully.");
  } else {
    showMessage(
      "Registration received. Check your email for the confirmation link, then sign in."
    );
  }
}

async function loginLandlord() {
  const email = document.getElementById("landlord-email").value.trim();
  const password = document.getElementById("landlord-password").value;

  showMessage("Signing in...");

  const { data, error } = await client.auth.signInWithPassword({
    email,
    password
  });

  if (error) {
    showMessage("Sign-in failed. Check your email and password.");
    return;
  }

  showSignedIn(data.user);
  showMessage("You are signed in.");
}

function makeSubmissionCard(house) {
  const card = document.createElement("article");
  card.className = "landlord-house";

  const title = document.createElement("h3");
  title.textContent = house.title;

  const area = document.createElement("p");
  area.textContent = "Area: " + house.area;

  const rent = document.createElement("p");
  rent.textContent =
    "Rent: KSh " + Number(house.rent).toLocaleString("en-KE") + " / month";

  const status = document.createElement("p");
  status.className = "status-label";
  status.textContent = "Status: " + house.status;
  status.dataset.status = String(house.status || "").toLowerCase();

  card.append(title, area, rent, status);
  return card;
}

async function loadMyHouses() {
  if (!currentUser) return;

  myHouses.replaceChildren();

  const loading = document.createElement("p");
  loading.textContent = "Loading your submissions...";
  myHouses.appendChild(loading);

  const { data, error } = await client
    .from("houses")
    .select("id, title, area, rent, status, created_at")
    .eq("owner_id", currentUser.id)
    .order("created_at", { ascending: false });

  myHouses.replaceChildren();

  if (error) {
    console.error("Could not load submissions:", error);
    showMessage(
      "We could not load your submissions. Database read policies may need updating."
    );
    return;
  }

  if (!data || data.length === 0) {
    const empty = document.createElement("p");
    empty.textContent = "You have not submitted any houses yet.";
    myHouses.appendChild(empty);
    return;
  }

  data.forEach(function (house) {
    myHouses.appendChild(makeSubmissionCard(house));
  });
}

async function submitHouse(event) {
  event.preventDefault();

  if (!currentUser) {
    showMessage("Please sign in before submitting a house.");
    return;
  }

  if (submittingHouse) return;

  const title = document.getElementById("house-title").value.trim();
  const area = document.getElementById("house-area").value;
  const rent = Number(document.getElementById("house-rent").value);
  const houseType = document.getElementById("house-type").value;
  const description =
    document.getElementById("house-description").value.trim();
  const contactPhone =
    document.getElementById("house-phone").value.trim();
  const photoInput = document.getElementById("house-photo");
  const photo = photoInput.files[0];

  if (!title || !area || !houseType || !contactPhone ||
      !Number.isSafeInteger(rent) || rent <= 0) {
    showMessage("Please enter valid house details and monthly rent.");
    return;
  }

  if (!photo) {
    showMessage("Please choose a house photo.");
    return;
  }

  const allowedTypes = ["image/jpeg", "image/png", "image/webp"];

  if (!allowedTypes.includes(photo.type)) {
    showMessage("Use a JPEG, PNG or WebP image.");
    return;
  }

  if (photo.size > 5 * 1024 * 1024) {
    showMessage("The photo must be no larger than 5 MB.");
    return;
  }

  submittingHouse = true;
  const submitButton = document.getElementById("submit-house-button");
  submitButton.disabled = true;
  showMessage("Uploading photo...");

  let uploadedPath = null;

  try {
    const extensionByType = {
      "image/jpeg": "jpg",
      "image/png": "png",
      "image/webp": "webp"
    };

    const filePath =
      currentUser.id + "/" + crypto.randomUUID() + "." +
      extensionByType[photo.type];

    const { data: uploadData, error: uploadError } = await client.storage
      .from("house-photos")
      .upload(filePath, photo, {
        contentType: photo.type,
        upsert: false
      });

    if (uploadError) {
      throw new Error(
        "Photo upload failed. Check Storage policies and bucket limits."
      );
    }

    uploadedPath = uploadData.path;

    showMessage("Saving house details...");

    const { data: insertedHouse, error: insertError } = await client
      .from("houses")
      .insert({
        title,
        area,
        rent,
        house_type: houseType,
        description,
        image_url: uploadedPath,
        contact_phone: contactPhone,
        owner_id: currentUser.id,
      })
      .select("id")
      .single();

    if (insertError) {
      throw new Error(
        "House submission failed. Check database permissions and required fields."
      );
    }

    houseForm.reset();
    showMessage(
      "House submitted successfully. It is pending administrator approval."
    );

    await loadMyHouses();
  } catch (error) {
    console.error("House submission error:", error);
    showMessage(error.message || "Something went wrong. Please try again.");

    // Avoid leaving an unused uploaded photo if the house insert failed.
    // This cleanup is best-effort; storage delete policies may deny it.
    if (uploadedPath) {
      const { error: cleanupError } = await client.storage
        .from("house-photos")
        .remove([uploadedPath]);

      if (cleanupError) {
        console.warn("Uploaded photo cleanup was not permitted.");
      }
    }
  } finally {
    submittingHouse = false;
    submitButton.disabled = false;
  }
}

document.getElementById("register-button").addEventListener(
  "click",
  async function (event) {
    event.preventDefault();
    await registerLandlord();
  }
);

document.getElementById("login-button").addEventListener(
  "click",
  async function () {
    if (!authForm.reportValidity()) return;

    await loginLandlord();
  }
);

authForm.addEventListener("submit", async function (event) {
  event.preventDefault();
  await registerLandlord();
});

houseForm.addEventListener("submit", submitHouse);

document.getElementById("logout-button").addEventListener(
  "click",
  async function () {
    const { error } = await client.auth.signOut();

    if (error) {
      showMessage("Sign-out failed. Please try again.");
      return;
    }

    showSignedOut();
    showMessage("You have signed out.");
  }
);

async function startLandlordPage() {
  if (!window.supabase) {
    showMessage("Supabase failed to load. Check your internet connection.");
    return;
  }

  client = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_PUBLISHABLE_KEY
  );

  const { data, error } = await client.auth.getSession();

  if (error) {
    showMessage("Could not check your login session.");
    return;
  }

  if (data.session) {
    showSignedIn(data.session.user);
  } else {
    showSignedOut();
  }

  client.auth.onAuthStateChange(function (_event, session) {
    setTimeout(function () {
      if (session) {
        showSignedIn(session.user);
      } else {
        showSignedOut();
      }
    }, 0);
  });
}

const photoInput = document.getElementById("house-photo");
const photoPreview = document.getElementById("photo-preview");
const photoFileName = document.getElementById("photo-file-name");
const uploadPlaceholder = document.getElementById("upload-placeholder");

function clearPhotoPreview() {
  if (photoPreviewUrl) {
    URL.revokeObjectURL(photoPreviewUrl);
    photoPreviewUrl = null;
  }

  photoPreview.removeAttribute("src");
  photoPreview.classList.add("hidden");
  photoFileName.classList.add("hidden");
  uploadPlaceholder.classList.remove("hidden");
}

photoInput.addEventListener("change", function () {
  const photo = photoInput.files[0];
  clearPhotoPreview();

  if (!photo) return;

  photoPreviewUrl = URL.createObjectURL(photo);
  photoPreview.src = photoPreviewUrl;
  photoPreview.classList.remove("hidden");
  photoFileName.textContent = photo.name;
  photoFileName.classList.remove("hidden");
  uploadPlaceholder.classList.add("hidden");
});

document.getElementById("house-description").addEventListener(
  "input",
  function (event) {
    document.getElementById("description-count").textContent =
      event.target.value.length;
  }
);

document.getElementById("login-button").addEventListener(
  "click",
  function () {
    document.getElementById("landlord-password").autocomplete =
      "current-password";
  }
);

authForm.addEventListener("submit", function () {
  document.getElementById("landlord-password").autocomplete =
    "new-password";
});

houseForm.addEventListener("reset", function () {
  clearPhotoPreview();
  document.getElementById("description-count").textContent = "0";
});

startLandlordPage();