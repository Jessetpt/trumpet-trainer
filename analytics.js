// Analytics page functionality
class NoteAnalytics {
    constructor() {
        this.currentData = [];
        this.currentSort = { field: 'avg_response_time', direction: 'desc' };
        this.currentFilters = { difficulty: '', time_mode: '' };
        this.analyticsCache = new Map();
        this.CACHE_DURATION = 60000; // 1 minute cache
        
        this.init();
    }

    init() {
        this.checkAuth();
        this.bindEvents();
        this.loadData();
    }

    checkAuth() {
        const token = localStorage.getItem('authToken');
        if (!token) {
            window.location.href = 'login.html';
            return;
        }
    }

    bindEvents() {
        const applyBtn = document.getElementById('apply-filters');
        if (applyBtn) {
            applyBtn.addEventListener('click', () => this.applyFilters());
        }

        // Add filter change listeners
        const difficultyFilter = document.getElementById('difficulty-filter');
        const timeFilter = document.getElementById('time-filter');
        
        if (difficultyFilter) {
            difficultyFilter.addEventListener('change', () => this.updateFilters());
        }
        if (timeFilter) {
            timeFilter.addEventListener('change', () => this.updateFilters());
        }

        // Add refresh button functionality
        const refreshBtn = document.getElementById('refresh-btn');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', () => {
                // Clear cache and reload
                this.analyticsCache.clear();
                this.loadData();
            });
        }
    }

    updateFilters() {
        const difficultyFilter = document.getElementById('difficulty-filter');
        const timeFilter = document.getElementById('time-filter');
        
        this.currentFilters = {
            difficulty: difficultyFilter ? difficultyFilter.value : '',
            time_mode: timeFilter ? timeFilter.value : ''
        };
    }

    async applyFilters() {
        this.updateFilters();
        await this.loadData();
    }

    async loadData() {
        try {
            const cacheKey = `${this.currentFilters.difficulty}-${this.currentFilters.time_mode}`;
            const cached = this.analyticsCache.get(cacheKey);
            
            // Check if we have recent cached data
            if (cached && (Date.now() - cached.timestamp) < this.CACHE_DURATION) {
                this.currentData = cached.data;
                this.updateStats();
                this.renderTable();
                return;
            }

            this.showLoading();
            
            const token = localStorage.getItem('authToken');
            if (!token) {
                this.showError('Authentication required. Please log in again.');
                return;
            }

            // Use configuration to get the correct API base URL
            const baseUrl = window.appConfig ? window.appConfig.apiBaseUrl : 'http://localhost:3000/api';
            const url = new URL(`${baseUrl}/analytics/note-responses`);
            
            // Add filters to query params
            if (this.currentFilters.difficulty) {
                url.searchParams.set('difficulty', this.currentFilters.difficulty);
            }
            if (this.currentFilters.time_mode) {
                url.searchParams.set('time_mode', this.currentFilters.time_mode);
            }

            const response = await fetch(url.toString(), {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Cache-Control': 'no-cache'
                }
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const data = await response.json();
            this.currentData = data.notes || [];
            
            // Cache the successful response
            this.analyticsCache.set(cacheKey, {
                data: this.currentData,
                timestamp: Date.now()
            });
            
            this.updateStats();
            this.renderTable();
            
        } catch (error) {
            console.error('Error loading analytics data:', error);
            this.showError(`Failed to load data: ${error.message}`);
        }
    }

    showLoading() {
        const tableContent = document.getElementById('table-content');
        if (tableContent) {
            tableContent.innerHTML = '<div class="loading">Loading your note data...</div>';
        }
    }

    showError(message) {
        const tableContent = document.getElementById('table-content');
        if (tableContent) {
            tableContent.innerHTML = `<div class="error">${message}</div>`;
        }
    }

    updateStats() {
        if (this.currentData.length === 0) {
            this.updateStat('total-notes', '0');
            this.updateStat('avg-response', '0ms');
            this.updateStat('overall-accuracy', '0%');
            this.updateStat('slowest-note', 'N/A');
            return;
        }

        // Calculate statistics
        const totalNotes = this.currentData.reduce((sum, note) => sum + note.attempts, 0);
        const totalResponseTime = this.currentData.reduce((sum, note) => sum + (note.avg_response_time * note.attempts), 0);
        const avgResponse = totalNotes > 0 ? Math.round(totalResponseTime / totalNotes) : 0;
        
        const totalCorrect = this.currentData.reduce((sum, note) => sum + Math.round(note.accuracy_pct * note.attempts / 100), 0);
        const overallAccuracy = totalNotes > 0 ? Math.round((totalCorrect / totalNotes) * 100) : 0;
        
        const slowestNote = this.currentData.reduce((slowest, note) => 
            note.avg_response_time > slowest.avg_response_time ? note : slowest
        );

        this.updateStat('total-notes', totalNotes.toLocaleString());
        this.updateStat('avg-response', `${avgResponse}ms`);
        this.updateStat('overall-accuracy', `${overallAccuracy}%`);
        this.updateStat('slowest-note', slowestNote ? slowestNote.note_name : 'N/A');
    }

    updateStat(id, value) {
        const element = document.getElementById(id);
        if (element) {
            element.textContent = value;
        }
    }

    renderTable() {
        const tableContent = document.getElementById('table-content');
        if (!tableContent) return;

        if (this.currentData.length === 0) {
            tableContent.innerHTML = '<div class="no-data">No note data found for the selected filters. Try playing some games first!</div>';
            return;
        }

        // Sort data
        this.sortData();

        const table = `
            <table>
                <thead>
                    <tr>
                        <th data-sort="note_name" style="cursor: pointer;">Note Name ↕</th>
                        <th data-sort="attempts" style="cursor: pointer;">Attempts ↕</th>
                        <th data-sort="avg_response_time" style="cursor: pointer;">Avg Response Time ↕</th>
                        <th data-sort="accuracy_pct" style="cursor: pointer;">Accuracy ↕</th>
                        <th>Performance</th>
                    </tr>
                </thead>
                <tbody>
                    ${this.currentData.map(note => this.renderNoteRow(note)).join('')}
                </tbody>
            </table>
        `;

        tableContent.innerHTML = table;
        this.bindTableSorting();
    }

    renderNoteRow(note) {
        const responseTimeClass = this.getResponseTimeClass(note.avg_response_time);
        const accuracyClass = this.getAccuracyClass(note.accuracy_pct);
        
        return `
            <tr>
                <td class="note-name">${note.note_name}</td>
                <td>${note.attempts}</td>
                <td class="response-time ${responseTimeClass}">${note.avg_response_time}ms</td>
                <td class="accuracy ${accuracyClass}">${note.accuracy_pct}%</td>
                <td>${this.getPerformanceSummary(note)}</td>
            </tr>
        `;
    }

    getResponseTimeClass(responseTime) {
        if (responseTime <= 1000) return 'fast';
        if (responseTime <= 2000) return 'medium';
        return 'slow';
    }

    getAccuracyClass(accuracy) {
        if (accuracy >= 80) return 'high-accuracy';
        if (accuracy >= 60) return 'medium-accuracy';
        return 'low-accuracy';
    }

    getPerformanceSummary(note) {
        const responseQuality = this.getResponseTimeClass(note.avg_response_time);
        const accuracyQuality = this.getAccuracyClass(note.accuracy_pct);
        
        if (responseQuality === 'fast' && accuracyQuality === 'high-accuracy') {
            return '🎯 Excellent - Keep it up!';
        } else if (responseQuality === 'fast' || accuracyQuality === 'high-accuracy') {
            return '👍 Good - Room for improvement';
        } else if (responseQuality === 'slow' && accuracyQuality === 'low-accuracy') {
            return '⚠️ Needs work - Practice this note!';
        } else {
            return '📚 Fair - Keep practicing';
        }
    }

    sortData() {
        const { field, direction } = this.currentSort;
        
        this.currentData.sort((a, b) => {
            let aVal = a[field];
            let bVal = b[field];
            
            // Handle numeric values
            if (typeof aVal === 'string' && aVal.includes('ms')) {
                aVal = parseInt(aVal);
                bVal = parseInt(bVal);
            }
            
            if (aVal < bVal) return direction === 'asc' ? -1 : 1;
            if (aVal > bVal) return direction === 'asc' ? 1 : -1;
            return 0;
        });
    }

    bindTableSorting() {
        const headers = document.querySelectorAll('th[data-sort]');
        headers.forEach(header => {
            header.addEventListener('click', () => {
                const field = header.dataset.sort;
                this.currentSort = {
                    field,
                    direction: this.currentSort.field === field && this.currentSort.direction === 'asc' ? 'desc' : 'asc'
                };
                this.renderTable();
            });
        });
    }
}

// Initialize analytics when page loads
document.addEventListener('DOMContentLoaded', () => {
    new NoteAnalytics();
}); 