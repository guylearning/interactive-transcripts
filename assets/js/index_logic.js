// assets/js/index_logic.js
document.addEventListener('DOMContentLoaded', () => {
    const searchIn = document.getElementById("searchInput");
    const clearBtn = document.getElementById("clearSearchBtn");
    const table = document.getElementById("lessonsTable");
    const tableBody = table.querySelector("tbody");
    const noResultsMsg = document.getElementById("noResultsMessage");
    const headers = table.querySelectorAll("thead th[data-sort-key]");

    // Ensure tableBody exists before querying its rows
    if (!tableBody) {
        console.warn("Table body not found for index page logic.");
        return;
    }
    const tableRowsInitially = Array.from(tableBody.querySelectorAll("tr"));


    function filterRows() {
        let searchTerm = searchIn.value.toLowerCase().trim();
        let visibleRows = 0;
        tableBody.querySelectorAll("tr").forEach(row => { // Query rows dynamically inside function
            let searchableText = row.dataset.searchableText || "";
            if (searchableText.includes(searchTerm)) {
                row.style.display = "";
                visibleRows++;
            } else {
                row.style.display = "none";
            }
        });
        noResultsMsg.style.display = visibleRows === 0 && searchTerm !== "" ? "block" : "none";
    }

    function sortTable(clickedHeader) {
        let sortKey = clickedHeader.dataset.sortKey;
        let currentDir = clickedHeader.dataset.sortDir;
        let newDir = (currentDir === "asc" || currentDir === "none") ? "desc" : "asc";

        headers.forEach(h => {
            if (h !== clickedHeader) {
                h.dataset.sortDir = "none"; // Reset other headers
                const arrow = h.querySelector(".sort-arrow");
                if(arrow) arrow.classList.remove("active-sort");
            }
        });
        clickedHeader.dataset.sortDir = newDir;
        const arrow = clickedHeader.querySelector(".sort-arrow");
        if(arrow) arrow.classList.add("active-sort");
        
        let rowsArray = Array.from(tableBody.querySelectorAll("tr")); // Get current rows

        rowsArray.sort((a, b) => {
            let valA = (a.dataset['value' + sortKey] || 
                        a.querySelector(`td[data-label='${clickedHeader.textContent.split(' ')[0]}']`)?.textContent.trim() || "").toLowerCase();
            let valB = (b.dataset['value' + sortKey] || 
                        b.querySelector(`td[data-label='${clickedHeader.textContent.split(' ')[0]}']`)?.textContent.trim() || "").toLowerCase();

            // For date, sort directly by ISO string from data-attribute
            if (sortKey === "created_timestamp_iso") {
                valA = a.dataset.valueCreatedTimestampIso || "";
                valB = b.dataset.valueCreatedTimestampIso || "";
            } else if (!isNaN(parseFloat(valA)) && !isNaN(parseFloat(valB)) && sortKey !== "tags" && sortKey !== "uploader" && sortKey !== "title_original" ) { 
                // Avoid converting tags/uploader/title to float if they happen to be numbers
                valA = parseFloat(valA);
                valB = parseFloat(valB);
            }
            
            if (valA < valB) return newDir === "asc" ? -1 : 1;
            if (valA > valB) return newDir === "asc" ? 1 : -1;
            return 0;
        });
        rowsArray.forEach(row => tableBody.appendChild(row)); // Re-append sorted rows
    }

    if (searchIn) searchIn.addEventListener("keyup", filterRows);
    if (clearBtn) clearBtn.addEventListener("click", () => { searchIn.value = ""; filterRows(); });
    headers.forEach(h => { h.addEventListener("click", () => sortTable(h)); });
});
