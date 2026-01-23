fetch('../output.json')
    .then(response => response.json())
    .then(data => {
        const tree = document.getElementById('tree');

        for (const folder in data) {

            // Card
            const card = document.createElement('div');
            card.className = 'folder-card';

            // Header
            const header = document.createElement('div');
            header.className = 'folder-header';

            const title = document.createElement('div');
            title.className = 'folder-title';
            title.textContent = '📁 ' + folder;

            const badge = document.createElement('div');
            badge.className = 'badge';
            badge.textContent = data[folder].length;

            header.appendChild(title);
            header.appendChild(badge);

            // File list
            const fileList = document.createElement('div');
            fileList.className = 'file-list';

            if (data[folder].length === 0) {
                const empty = document.createElement('div');
                empty.className = 'empty';
                empty.textContent = '(empty)';
                fileList.appendChild(empty);
            } else {
                data[folder].forEach(file => {
                    const fileDiv = document.createElement('div');
                    fileDiv.className = 'file';
                    fileDiv.textContent = '📄 ' + file;
                    fileList.appendChild(fileDiv);
                });
            }

            // Toggle animation
            header.addEventListener('click', () => {
                fileList.classList.toggle('open');
            });

            card.appendChild(header);
            card.appendChild(fileList);
            tree.appendChild(card);
        }
    })
    .catch(err => {
        console.error('Error loading output.json', err);
    });
