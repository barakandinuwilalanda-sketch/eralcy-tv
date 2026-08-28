let allPosts = [];


/* =========================
   LOAD POSTS
========================= */

async function loadPosts() {

    try {

        const response =
            await fetch("/api/posts");

        allPosts =
            await response.json();

        displayPosts(allPosts);

    }

    catch(error) {

        console.error(error);

    }

}


/* =========================
   DISPLAY POSTS
========================= */

function displayPosts(posts) {

    const grid =
        document.getElementById(
            "newsGrid"
        );


    grid.innerHTML = "";


    if (!posts.length) {

        grid.innerHTML = `

            <p>
                Hakuna posts kwa sasa.
            </p>

        `;

        return;

    }


    posts.forEach(post => {

        let media = "";


        /*
        ========================
        LOCAL VIDEO
        ========================
        */

        if (post.video) {

            media = `

                <video
                    controls
                    preload="metadata"
                >

                    <source
                        src="${post.video}"
                        type="video/mp4"
                    >

                    Browser yako
                    haiwezi ku-play video.

                </video>

            `;

        }


        /*
        ========================
        TIKTOK EMBED
        ========================
        */

        else if (
            post.source === "TikTok" &&
            post.embed
        ) {

            media = `

                <iframe
                    src="${post.embed}"
                    class="social-video"
                    loading="lazy"
                    allow="fullscreen"
                >
                </iframe>

            `;

        }


        /*
        ========================
        IMAGE
        ========================
        */

        else if (post.image) {

            media = `

                <img
                    src="${post.image}"
                    alt="${escapeHTML(
                        post.title
                    )}"
                >

            `;

        }


        let source = "";


        if (post.sourceUrl) {

            source = `

                <a
                    class="source"
                    href="${post.sourceUrl}"
                    target="_blank"
                    rel="noopener"
                >

                    🔗 Fungua
                    ${post.source}

                </a>

            `;

        }


        let expiry = "";


        if (post.expiresAt) {

            const remaining =
                post.expiresAt -
                Date.now();


            if (remaining > 0) {

                const hours =
                    Math.floor(
                        remaining /
                        3600000
                    );


                const minutes =
                    Math.floor(
                        (
                            remaining %
                            3600000
                        ) / 60000
                    );


                expiry = `

                    <div class="expiry">

                        ⏳
                        ${hours}h
                        ${minutes}m
                        zimebaki

                    </div>

                `;

            }

        }


        grid.innerHTML += `

            <article class="card">

                ${media}

                <div class="card-body">

                    <span class="category">

                        ${escapeHTML(
                            post.category
                        )}

                    </span>


                    <h2>

                        ${escapeHTML(
                            post.title
                        )}

                    </h2>


                    <p>

                        ${escapeHTML(
                            post.content
                        )}

                    </p>


                    ${source}

                    ${expiry}

                </div>

            </article>

        `;

    });

}


/* =========================
   CATEGORY
========================= */

function filterPosts(category) {

    if (category === "all") {

        displayPosts(allPosts);

        return;

    }


    const filtered =
        allPosts.filter(
            post =>
            post.category === category
        );


    displayPosts(filtered);

}


/* =========================
   SEARCH
========================= */

function searchPosts() {

    const query =
        document
        .getElementById("search")
        .value
        .toLowerCase();


    const results =
        allPosts.filter(post =>

            (
                post.title ||
                ""
            )
            .toLowerCase()
            .includes(query)

            ||

            (
                post.content ||
                ""
            )
            .toLowerCase()
            .includes(query)

            ||

            (
                post.category ||
                ""
            )
            .toLowerCase()
            .includes(query)

        );


    displayPosts(results);

}


/* =========================
   SECURITY
========================= */

function escapeHTML(text) {

    return String(text)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");

}


/* =========================
   START
========================= */

loadPosts();


/*
Website itajisisha
kila sekunde 30.
*/

setInterval(
    loadPosts,
    30000
);