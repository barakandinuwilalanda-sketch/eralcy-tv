// Function ya kupakua na kuonyesha Post zote
async function loadPosts() {
    try {
        const response = await fetch('/api/posts');
        const posts = await response.json();

        // Sehemu kwenye HTML ambapo post zitaonyeshwa (Tumia newsGrid kama ilivyo kwenye HTML yako, au weka postsContainer)
        const container = document.getElementById('newsGrid') || document.getElementById('postsContainer');
        if (!container) return;

        container.innerHTML = '';

        if (!posts || posts.length === 0) {
            container.innerHTML = '<p class="no-posts">Hakuna post yoyote iliyowekwa bado.</p>';
            return;
        }

        // Kupanga na kutengeneza kadi kwa kila post
        posts.forEach(post => {
            const card = document.createElement('div');
            card.className = 'news-card';

            let postDate = '';
            if (post.created_at) {
                postDate = new Date(post.created_at).toLocaleString('sw-TZ', {
                    dateStyle: 'medium',
                    timeStyle: 'short'
                });
            }

            // Angalia kiungo cha picha, kama hakina http tumia 'elilucy.jpeg'
            const rawImage = post.image || post.displayUrl || post.media_url || post.imageUrl || post.thumbnailUrl || post.url || '';
            const finalImage = rawImage.startsWith('http') ? rawImage : 'elilucy.jpeg';

            card.innerHTML = `
                <div class="post-header">
                    <span class="category-tag">${post.category || 'Instagram'}</span>
                    <small class="post-date">${postDate}</small>
                </div>
                <h2 class="post-title">${post.title || 'Post mpya ya Instagram'}</h2>
                <img src="${finalImage}" alt="Post" style="width:100%; height:180px; object-fit:cover; border-radius:8px; margin-top:10px;">
                <div class="post-content">
                    <p>${post.content || ''}</p>
                </div>
            `;

            container.appendChild(card);
        });
    } catch (err) {
        console.error("Kosa wakati wa kupakua posts:", err);
    }
}

// Ita function hii mara tu ukurasa unapomaliza kufunguka
document.addEventListener('DOMContentLoaded', loadPosts);