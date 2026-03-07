// --- BIẾN TOÀN CỤC LƯU DỮ LIỆU AI TẠM THỜI ---
        let currentAIData = null;

        // --- TAB 3: LOGIC GỌI AI TRỢ GIẢNG THẬT ---
        async function askAIAssistant() {
            const word = document.getElementById('aiInputWord').value.trim();
            if(!word) { alert("Hãy nhập một từ để AI phân tích nhé!"); return; }

            document.getElementById('aiResultCard').style.display = 'none';
            document.getElementById('aiLoading').style.display = 'block';

            try {
                // Gọi lên Server Node.js của chúng ta
                const response = await fetch('/api/ai-analyze', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ word: word })
                });

                if (!response.ok) throw new Error("Lỗi kết nối AI");
                const aiData = await response.json();
                
                // Lưu tạm để nếu người dùng muốn "Lưu vào sổ tay"
                currentAIData = aiData;
                
                // Render Gia đình từ (Tags)
                let familyHTML = '';
                if (aiData.family && aiData.family.length > 0) {
                    aiData.family.forEach(f => {
                        let tagClass = "tag-noun";
                        if (f.pos.toLowerCase().includes('động') || f.pos.toLowerCase().includes('verb')) tagClass = "tag-verb";
                        if (f.pos.toLowerCase().includes('tính') || f.pos.toLowerCase().includes('adj')) tagClass = "tag-adj";
                        familyHTML += `<span class="tag ${tagClass}">${f.pos}: <b>${f.word}</b> (${f.mean})</span>`;
                    });
                } else {
                    familyHTML = `<span style="color:#888;">Không có từ họ hàng phổ biến.</span>`;
                }

                // Render Ví dụ
                let examplesHTML = '';
                if (aiData.examples && aiData.examples.length > 0) {
                    aiData.examples.forEach(ex => {
                        examplesHTML += `
                        <div class="ai-example-box">
                            <p class="ai-example-en">"${ex.en}"</p>
                            <p class="ai-example-vi">"${ex.vi}"</p>
                        </div>`;
                    });
                }

                // Lắp ráp HTML
                const resultHTML = `
                    <div style="display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 10px;">
                        <div>
                            <h2 class="ai-word-title">${aiData.word.charAt(0).toUpperCase() + aiData.word.slice(1)}</h2>
                            <span class="ai-phonetic">${aiData.phonetic}</span>
                            <button class="btn btn-audio" onclick="speakWord('${aiData.word.replace(/'/g, "\\'")}')" style="margin-top:-5px;"><i class="fas fa-volume-up"></i> Nghe đọc</button>
                        </div>
                        <button class="btn btn-success" onclick="saveAIToHandbook()" title="Chuyển dữ liệu sang form Thêm từ"><i class="fas fa-save"></i> Lưu vào Sổ tay</button>
                    </div>
                    
                    <div class="ai-section" style="margin-top: 20px;">
                        <h4><i class="fas fa-book-reader"></i> Định nghĩa chính</h4>
                        <p style="font-size: 16px; color: #4a4a4a; margin: 0;"><b>[${aiData.pos}]:</b> ${aiData.mean}</p>
                    </div>

                    <div class="ai-section">
                        <h4><i class="fas fa-sitemap"></i> Gia đình từ (Word Family)</h4>
                        <div class="word-family-tags">${familyHTML}</div>
                    </div>

                    <div class="ai-section">
                        <h4><i class="fas fa-quote-left"></i> Câu ví dụ minh họa</h4>
                        ${examplesHTML}
                    </div>
                `;

                document.getElementById('aiLoading').style.display = 'none';
                const resultCard = document.getElementById('aiResultCard');
                resultCard.innerHTML = resultHTML;
                resultCard.style.display = 'block';

            } catch (error) {
                console.error(error);
                document.getElementById('aiLoading').style.display = 'none';
                alert("Ối! Phép thuật bị gián đoạn. AI đang nghỉ ngơi, bạn hãy thử lại nhé!");
            }
        }

        // --- HÀM TIỆN ÍCH: CHUYỂN DATA AI SANG FORM THÊM TỪ ---
        function saveAIToHandbook() {
            if(!currentAIData) return;
            
            // Chuyển sang Tab 1
            openTab({ currentTarget: document.querySelectorAll('.tab-links')[0] }, 'tab1');
            
            // Mở Modal Thêm Từ
            openAddModal();
            
            // Điền sẵn dữ liệu AI vừa phân tích
            document.getElementById('inpWord').value = currentAIData.word;
            document.getElementById('inpPronun').value = currentAIData.phonetic;
            document.getElementById('inpPart').value = currentAIData.pos;
            document.getElementById('inpMean').value = currentAIData.mean;
            
            // Lấy 1 câu ví dụ đầu tiên (nếu có)
            if(currentAIData.examples && currentAIData.examples.length > 0) {
                document.getElementById('inpExample').value = currentAIData.examples[0].en + " (" + currentAIData.examples[0].vi + ")";
            }
        }