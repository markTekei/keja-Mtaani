/*
    KEJA MTAANI
    Sample rental listings for learning and demonstration.

    Replace the example WhatsApp number below with your own
    number, using Kenya's country code 254.
*/

const whatsappNumber = "254700000000";

const houses = [
    {
        id: 1,
        name: "Affordable Single Room",
        area: "Kangemi",
        rent: 3000,
        type: "Single room",
        details: "Sample listing. Confirm facilities and extra costs."
    },
    {
        id: 2,
        name: "Budget Bedsitter",
        area: "Kangemi",
        rent: 5500,
        type: "Bedsitter",
        details: "Sample listing. Ask about the deposit."
    },
    {
        id: 3,
        name: "Single Room Rental",
        area: "Mountain View",
        rent: 3500,
        type: "Single room",
        details: "Sample listing. Confirm the exact location."
    },
    {
        id: 4,
        name: "Compact Bedsitter",
        area: "Mountain View",
        rent: 6500,
        type: "Bedsitter",
        details: "Sample listing. Confirm availability."
    },
    {
        id: 5,
        name: "One Bedroom Home",
        area: "Kitisuru",
        rent: 12000,
        type: "One bedroom",
        details: "Sample listing. Ask about water charges."
    },
    {
        id: 6,
        name: "Small Bedsitter",
        area: "Highridge",
        rent: 8000,
        type: "Bedsitter",
        details: "Sample listing. Confirm transport options."
    },
    {
        id: 7,
        name: "Budget Single Room",
        area: "Parklands",
        rent: 5000,
        type: "Single room",
        details: "Sample listing. Confirm the address."
    }
];

const houseList = document.getElementById("house-list");
const resultCount = document.getElementById("result-count");
const searchForm = document.getElementById("search-form");

function formatRent(rent) {
    return rent.toLocaleString("en-KE");
}

function openWhatsApp(message) {
    const url =
        `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(message)}`;

    window.open(url, "_blank", "noopener,noreferrer");
}

function displayHouses(list) {
    houseList.replaceChildren();

    resultCount.textContent =
        `${list.length} ${list.length === 1 ? "house" : "houses"} found`;

    if (list.length === 0) {
        const emptyMessage = document.createElement("p");
        emptyMessage.className = "no-results";
        emptyMessage.textContent =
            "No matching sample houses found. Try increasing your budget or choosing another area.";

        houseList.appendChild(emptyMessage);
        return;
    }

    list.forEach(function (house) {
        const card = document.createElement("article");
        card.className = "house-card";

        const type = document.createElement("span");
        type.className = "house-type";
        type.textContent = house.type;

        const title = document.createElement("h3");
        title.textContent = house.name;

        const area = document.createElement("p");
        area.className = "house-area";
        area.textContent = `📍 ${house.area}, Westlands area`;

        const price = document.createElement("p");
        price.className = "house-price";
        price.textContent = `KSh ${formatRent(house.rent)} / month`;

        const details = document.createElement("p");
        details.className = "house-details";
        details.textContent = house.details;

        const button = document.createElement("button");
        button.className = "button";
        button.type = "button";
        button.textContent = "Enquire on WhatsApp";

        button.addEventListener("click", function () {
            const message =
                `Hello, I found your listing on Keja Mtaani. ` +
                `I would like to enquire about ${house.name} in ${house.area}. ` +
                `The displayed sample rent is KSh ${formatRent(house.rent)} per month. ` +
                `Please confirm if a real house is available and share its exact location.`;

            openWhatsApp(message);
        });

        card.append(type, title, area, price, details, button);
        houseList.appendChild(card);
    });
}

searchForm.addEventListener("submit", function (event) {
    event.preventDefault();

    const selectedArea = document.getElementById("area").value;
    const maxRentInput = document.getElementById("max-rent").value;
    const selectedType = document.getElementById("house-type").value;

    const maxRent =
        maxRentInput.trim() === "" ? Infinity : Number(maxRentInput);

    if (!Number.isFinite(maxRent) && maxRent !== Infinity) {
        alert("Please enter a valid maximum rent.");
        return;
    }

    if (maxRent < 0) {
        alert("Maximum rent cannot be negative.");
        return;
    }

    const filteredHouses = houses.filter(function (house) {
        const matchesArea =
            selectedArea === "all" || house.area === selectedArea;

        const matchesRent = house.rent <= maxRent;

        const matchesType =
            selectedType === "all" || house.type === selectedType;

        return matchesArea && matchesRent && matchesType;
    });

    displayHouses(filteredHouses);
});

document.getElementById("reset").addEventListener("click", function () {
    searchForm.reset();
    displayHouses(houses);
});

document.getElementById("contact-form").addEventListener(
    "submit",
    function (event) {
        event.preventDefault();

        const name = document.getElementById("name").value.trim();
        const area = document.getElementById("contact-area").value;
        const budget = document.getElementById("budget").value;
        const details =
            document.getElementById("contact-message").value.trim();

        if (name === "" || budget === "" || Number(budget) < 0) {
            alert("Please enter your name and a valid budget.");
            return;
        }

        const message =
            `Hello Keja Mtaani. My name is ${name}. ` +
            `I am looking for a rental house in ${area}. ` +
            `My monthly budget is KSh ${formatRent(Number(budget))}. ` +
            `Additional details: ${details || "None provided"}.`;

        openWhatsApp(message);
    }
);

document.getElementById("year").textContent =
    new Date().getFullYear();

// Show all sample listings when the website opens.
displayHouses(houses);