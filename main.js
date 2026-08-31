async function loadPosts() {
    try {
        const response = await fetch('/api/posts');
        const posts = await response.json();

        const container = document.getElementById('newsGrid') || document.getElementById('postsContainer');
        if (!container) return;

        container.innerHTML = '';

        if (!posts || posts.length === 0) {
            container.innerHTML = '<p class="no-posts">Hakuna post yoyote iliyowekwa bado.</p>';
            return;
        }

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

            // Chukua link halisi ya picha kutoka Instagram
            const rawImage = post.image || post.displayUrl || post.media_url || post.imageUrl || post.thumbnailUrl || '';
            const finalImage = (rawImage && rawImage.startsWith('http')) ? rawImage : 'elilucy.jpeg';

            // Chukua link halisi ya video kutoka Instagram
            const rawVideo = post.video || post.videoUrl || post.video_url || '';

            let mediaHTML = '';
            if (rawVideo && rawVideo.startsWith('http')) {
                mediaHTML = `
                    <div class="video-container" style="position:relative; margin-top:10px;">
                        <video controls width="100%" poster="${finalImage}" onerror="this.poster='elilucy.jpeg';" style="max-height:400px; width:100%; object-fit:cover; border-radius:8px; background:#000;">
                            <source src="${rawVideo}" type="video/mp4">
                            Kivinjari chako hakiauni video hii.
                        </video>
                    </div>`;
            } else {
                mediaHTML = `
                    <img src="${finalImage}" 
                         alt="${post.title || 'Instagram Post'}" 
                         onerror="this.onerror=null; this.src='elilucy.jpeg';" 
                         style="width:100%; max-height:350px; object-fit:cover; border-radius:8px; margin-top:10px;">`;
            }

            card.innerHTML = `
                <div class="post-header">
                    <span class="category-tag">${post.category || 'Instagram'}</span>
                    <small class="post-date">${postDate}</small>
                </div>
                <h2 class="post-title">${post.title || 'Post mpya ya Instagram'}</h2>
                ${mediaHTML}
                <div class="post-content" style="margin-top:10px;">
                    <p>${post.content || ''}</p>
                </div>
            `;

            container.appendChild(card);
        });
    } catch (err) {
        console.error("Kosa wakati wa kupakua posts:", err);
    }
}

document.addEventListener('DOMContentLoaded', loadPosts);