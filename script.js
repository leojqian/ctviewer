class CTLogViewer {
    constructor() {
        this.logs = {
            bt: { element: null, visibleLines: [], currentOffset: 0, totalLines: 0, loading: false, searchResults: [] },
            out: { element: null, visibleLines: [], currentOffset: 0, totalLines: 0, loading: false, searchResults: [] },
            rs: { element: null, visibleLines: [], currentOffset: 0, totalLines: 0, loading: false, searchResults: [] }
        };
        this.syncScroll = false;
        this.autoScroll = true;
        this.showTimestamps = true;
        this.currentSearch = '';
        this.selectedSecond = null;
        this.groupBySecond = true;
        this.isGroupSelectionActive = false;
        
        // Performance optimizations
        this.linesPerPage = 100;
        this.debounceTimer = null;
        this.scrollSyncTimer = null;
        this.stats = {};
        this.secondIndex = {}; // Index of seconds across all panels
        this.errorPositions = {}; // Track error positions for scrollbar indicators
        
        this.initializeElements();
        this.bindEvents();
        this.initializeViewer();
    }

    initializeElements() {
        // Log content elements
        this.logs.bt.element = document.getElementById('btLog');
        this.logs.out.element = document.getElementById('outLog');
        this.logs.rs.element = document.getElementById('rsLog');

        // Control elements
        this.globalSearch = document.getElementById('globalSearch');
        this.groupToggleBtn = document.getElementById('groupToggle');
        this.syncScrollBtn = document.getElementById('syncScroll');
        this.exportBtn = document.getElementById('exportBtn');
        this.autoScrollCheckbox = document.getElementById('autoScroll');
        this.showTimestampsCheckbox = document.getElementById('showTimestamps');
        
        // Status elements
        this.totalLinesSpan = document.getElementById('totalLines');
        this.searchResultsSpan = document.getElementById('searchResults');
        this.selectedSecondSpan = document.getElementById('selectedSecond');

        // File inputs
        this.btFileInput = document.getElementById('btFile');
        this.outFileInput = document.getElementById('outFile');
        this.rsFileInput = document.getElementById('rsFile');
    }

    bindEvents() {
        // Global search with debouncing
        this.globalSearch.addEventListener('input', (e) => {
            this.currentSearch = e.target.value;
            this.debounceSearch();
        });

        // Handle window resize to update scrollbar indicators
        window.addEventListener('resize', () => {
            if (this.errorPositions) {
                Object.keys(this.logs).forEach(panel => {
                    this.updateScrollbarIndicators(panel);
                });
            }
        });

        // Handle manual scrolling to clear group selection if user scrolls away
        Object.keys(this.logs).forEach(panel => {
            const log = this.logs[panel];
            log.element.addEventListener('scroll', (e) => {
                // If user manually scrolls while a group is selected, clear the selection
                if (this.selectedSecond && !this.isGroupSelectionActive) {
                    this.clearSelection();
                }
            });
        });

        // Panel-specific search with debouncing
        document.querySelectorAll('.panel-search').forEach(input => {
            input.addEventListener('input', (e) => {
                const panel = e.target.dataset.panel;
                this.debouncePanelSearch(panel, e.target.value);
            });
        });

        // Clear search buttons
        document.querySelectorAll('.btn-clear').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const panel = e.target.closest('.btn-clear').dataset.panel;
                this.clearPanelSearch(panel);
            });
        });

        // Group toggle
        this.groupToggleBtn.addEventListener('click', () => {
            this.groupBySecond = !this.groupBySecond;
            this.groupToggleBtn.innerHTML = this.groupBySecond ? 
                '<i class="fas fa-layer-group"></i> Group by Second' : 
                '<i class="fas fa-list"></i> Show All Lines';
            this.groupToggleBtn.classList.toggle('btn-primary');
            this.groupToggleBtn.classList.toggle('btn-secondary');
            this.redrawAllLogs();
        });

        // Sync scroll
        this.syncScrollBtn.addEventListener('click', () => {
            this.syncScroll = !this.syncScroll;
            this.syncScrollBtn.innerHTML = this.syncScroll ? 
                '<i class="fas fa-unlink"></i> Unsync Scroll' : 
                '<i class="fas fa-link"></i> Sync Scroll';
            this.syncScrollBtn.classList.toggle('btn-primary');
            this.syncScrollBtn.classList.toggle('btn-secondary');
            
            // Add visual feedback
            if (this.syncScroll) {
                this.showNotification('Sync scroll enabled - all panels will scroll together');
            } else {
                this.showNotification('Sync scroll disabled - panels scroll independently');
            }
        });

        // Export
        this.exportBtn.addEventListener('click', () => this.exportLogs());

        // Checkboxes
        this.autoScrollCheckbox.addEventListener('change', (e) => {
            this.autoScroll = e.target.checked;
        });

        this.showTimestampsCheckbox.addEventListener('change', (e) => {
            this.showTimestamps = e.target.checked;
            this.redrawAllLogs();
        });

        // File inputs
        this.btFileInput.addEventListener('change', (e) => this.handleFileUpload('bt', e));
        this.outFileInput.addEventListener('change', (e) => this.handleFileUpload('out', e));
        this.rsFileInput.addEventListener('change', (e) => this.handleFileUpload('rs', e));

        // Scroll events for lazy loading and sync
        Object.values(this.logs).forEach(log => {
            log.element.addEventListener('scroll', (e) => {
                this.handleScroll(e.target);
            });
        });

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            if (e.ctrlKey || e.metaKey) {
                if (e.key === 'f') {
                    e.preventDefault();
                    this.globalSearch.focus();
                } else if (e.key === 's') {
                    e.preventDefault();
                    this.exportLogs();
                }
            } else if (e.key === 'Escape') {
                this.clearAllHighlights();
                this.clearSelection();
            }
        });
    }

    async initializeViewer() {
        try {
            this.showLoadingOverlay('Initializing viewer...');
            
            // Get file statistics first
            await this.loadStats();
            
            // Load initial content for all panels
            await Promise.all([
                this.loadLogData('bt', 0),
                this.loadLogData('out', 0),
                this.loadLogData('rs', 0)
            ]);
            
            // Build second index for cross-panel selection
            this.buildSecondIndex();
            
            // Load all errors for scrollbar indicators
            await this.loadAllErrors();
            
            // Initialize error indicators after content is loaded
            Object.keys(this.logs).forEach(panel => {
                this.updateErrorCount(panel);
            });
            
            // Initialize file upload functionality
            this.initFileUpload();
            
            this.hideLoadingOverlay();
            this.updateStatus();
        } catch (error) {
            console.error('Error initializing viewer:', error);
            this.hideLoadingOverlay();
            this.showError('Failed to initialize viewer. Please refresh the page.');
        }
    }

    buildSecondIndex() {
        // Build an index of all seconds across all panels
        this.secondIndex = {};
        
        Object.keys(this.logs).forEach(panel => {
            const log = this.logs[panel];
            log.visibleLines.forEach(line => {
                if (line.secondKey) {
                    if (!this.secondIndex[line.secondKey]) {
                        this.secondIndex[line.secondKey] = {};
                    }
                    if (!this.secondIndex[line.secondKey][panel]) {
                        this.secondIndex[line.secondKey][panel] = [];
                    }
                    this.secondIndex[line.secondKey][panel].push(line);
                }
            });
        });
    }

    async loadStats() {
        try {
            const response = await fetch('/api/stats');
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            
            this.stats = await response.json();
        } catch (error) {
            console.error('Error loading stats:', error);
        }
    }

    async loadLogData(panel, offset, search = '') {
        const log = this.logs[panel];
        if (log.loading) return;
        
        log.loading = true;
        
        try {
            const params = new URLSearchParams({
                panel: panel,
                offset: offset,
                limit: this.linesPerPage
            });
            
            if (search) {
                params.append('search', search);
            }
            
            const response = await fetch(`/api/logs?${params}`);
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            
            const data = await response.json();
            
            if (offset === 0) {
                // Initial load - replace all content
                log.visibleLines = data.lines;
                log.currentOffset = 0;
            } else {
                // Append new content
                log.visibleLines = [...log.visibleLines, ...data.lines];
            }
            
            log.totalLines = this.stats[panel]?.totalLines || 0;
            
            this.renderLog(panel);
            
            // Update second index when new data is loaded
            this.updateSecondIndex(panel, data.lines);
            
        } catch (error) {
            console.error(`Error loading log data for ${panel}:`, error);
            log.element.innerHTML = `
                <div class="loading" style="color: #ef4444;">
                    Failed to load log data: ${error.message}
                </div>
            `;
        } finally {
            log.loading = false;
        }
    }

    updateSecondIndex(panel, newLines) {
        // Update the second index with new lines
        newLines.forEach(line => {
            if (line.secondKey) {
                if (!this.secondIndex[line.secondKey]) {
                    this.secondIndex[line.secondKey] = {};
                }
                if (!this.secondIndex[line.secondKey][panel]) {
                    this.secondIndex[line.secondKey][panel] = [];
                }
                this.secondIndex[line.secondKey][panel].push(line);
            }
        });
        
        // Update error positions when new content is loaded
        this.updateErrorPositionsFromNewContent(panel, newLines);
    }

    updateErrorPositions(panel, newLines) {
        if (!this.errorPositions[panel]) {
            this.errorPositions[panel] = [];
        }
        
        let foundErrors = 0;
        newLines.forEach((line, index) => {
            if (line.level === 'error' || line.level === 'warning') {
                foundErrors++;
                this.errorPositions[panel].push({
                    lineNumber: line.lineNumber,
                    level: line.level,
                    offset: this.logs[panel].currentOffset + index
                });
            }
        });
        
        if (foundErrors > 0) {
            console.log(`Found ${foundErrors} errors/warnings in ${panel} panel`);
            console.log(`Total errors for ${panel}:`, this.errorPositions[panel].length);
        }
        
        // Update scrollbar indicators
        this.updateScrollbarIndicators(panel);
        // Update error count display
        this.updateErrorCount(panel);
    }

    updateScrollbarIndicators(panel) {
        const log = this.logs[panel];
        const element = log.element;
        const indicatorsContainer = element.querySelector('.scrollbar-indicators');
        
        if (!indicatorsContainer) {
            console.log(`No indicators container found for ${panel}`);
            return;
        }
        
        if (!this.errorPositions[panel]) {
            console.log(`No error positions for ${panel}`);
            return;
        }
        
        console.log(`Updating scrollbar indicators for ${panel}:`, {
            totalErrors: this.errorPositions[panel].length,
            totalLines: this.stats[panel]?.totalLines,
            scrollHeight: element.scrollHeight,
            clientHeight: element.clientHeight
        });
        
        // Clear existing indicators
        indicatorsContainer.innerHTML = '';
        
        const totalLines = this.stats[panel]?.totalLines || 1;
        const scrollHeight = element.scrollHeight;
        const clientHeight = element.clientHeight;
        
        // Only show indicators if we have errors
        if (this.errorPositions[panel].length === 0) {
            console.log(`No errors to show for ${panel}`);
            return;
        }
        
        // Create indicators for all errors (no sampling needed since we load all at once)
        this.createIndicators(indicatorsContainer, this.errorPositions[panel], totalLines, scrollHeight, clientHeight, panel);
    }

    createIndicators(container, errors, totalLines, scrollHeight, clientHeight, panel) {
        console.log(`Creating ${errors.length} indicators for ${panel}`);
        
        errors.forEach((error, index) => {
            // Calculate position as percentage of total content height
            const positionPercent = (error.offset / totalLines);
            const topPosition = positionPercent * clientHeight;
            
            console.log(`Error ${index + 1}:`, {
                offset: error.offset,
                totalLines: totalLines,
                positionPercent: positionPercent,
                topPosition: topPosition,
                clientHeight: clientHeight,
                level: error.level
            });
            
            // Create indicator element (don't limit to visible bounds)
            const indicator = document.createElement('div');
            indicator.className = `error-indicator ${error.level}`;
            indicator.style.top = `${topPosition}px`;
            indicator.style.position = 'absolute';
            indicator.style.right = '2px';
            indicator.style.zIndex = '10';
            indicator.title = `${error.level.toUpperCase()}: Line ${error.lineNumber}`;
            
            // Add click handler to scroll to this position
            indicator.addEventListener('click', () => {
                this.scrollToLine(panel, error.offset);
            });
            
            container.appendChild(indicator);
            console.log(`Added indicator for ${error.level} at position ${topPosition}px`);
        });
        
        console.log(`Total indicators created for ${panel}:`, container.children.length);
    }

    scrollToLine(panel, lineOffset) {
        const log = this.logs[panel];
        const element = log.element;
        
        // Calculate scroll position based on line offset
        const totalLines = this.stats[panel]?.totalLines || 1;
        const scrollHeight = element.scrollHeight;
        const scrollPosition = (lineOffset / totalLines) * scrollHeight;
        
        // Ensure we don't scroll beyond bounds
        const maxScroll = scrollHeight - element.clientHeight;
        const clampedPosition = Math.max(0, Math.min(scrollPosition, maxScroll));
        
        element.scrollTo({
            top: clampedPosition,
            behavior: 'smooth'
        });
        
        // If sync scroll is enabled, sync other panels
        if (this.syncScroll) {
            this.syncScrollPosition(element);
        }
    }

    updateErrorCount(panel) {
        const errorCountElement = document.getElementById(`${panel}ErrorCount`);
        if (!errorCountElement) return;
        
        const errors = this.errorPositions[panel] || [];
        const errorCount = errors.filter(e => e.level === 'error').length;
        const warningCount = errors.filter(e => e.level === 'warning').length;
        const totalCount = errorCount + warningCount;
        
        if (totalCount === 0) {
            errorCountElement.textContent = '';
            errorCountElement.className = 'error-count';
        } else {
            let text = '';
            if (errorCount > 0 && warningCount > 0) {
                text = `${errorCount}E ${warningCount}W`;
            } else if (errorCount > 0) {
                text = `${errorCount}E`;
            } else {
                text = `${warningCount}W`;
            }
            
            errorCountElement.textContent = text;
            errorCountElement.className = 'error-count';
            
            if (errorCount > 0) {
                errorCountElement.classList.add('has-errors');
            } else if (warningCount > 0) {
                errorCountElement.classList.add('has-warnings');
            }
        }
    }

    async loadAllErrors() {
        try {
            console.log('Loading all errors for scrollbar indicators...');
            
            // For now, let's use the existing loaded content to detect errors
            // This will be faster and more reliable
            Object.keys(this.logs).forEach(panel => {
                this.detectErrorsFromLoadedContent(panel);
            });
            
            console.log('Error detection completed');
            
        } catch (error) {
            console.error('Error detecting errors:', error);
        }
    }

    detectErrorsFromLoadedContent(panel) {
        const log = this.logs[panel];
        if (!log.visibleLines || log.visibleLines.length === 0) return;
        
        // Initialize error positions array
        if (!this.errorPositions[panel]) {
            this.errorPositions[panel] = [];
        }
        
        // Clear existing errors for this panel
        this.errorPositions[panel] = [];
        
        // Detect errors from loaded content
        log.visibleLines.forEach((line, index) => {
            if (line.level === 'error' || line.level === 'warning') {
                this.errorPositions[panel].push({
                    lineNumber: line.lineNumber,
                    level: line.level,
                    offset: log.currentOffset + index
                });
            }
        });
        
        console.log(`Detected ${this.errorPositions[panel].length} errors in ${panel} panel`);
        
        // Update scrollbar indicators
        this.updateScrollbarIndicators(panel);
        this.updateErrorCount(panel);
    }

    updateErrorPositionsFromNewContent(panel, newLines) {
        if (!this.errorPositions[panel]) {
            this.errorPositions[panel] = [];
        }
        
        // Add new errors to existing ones
        newLines.forEach((line, index) => {
            if (line.level === 'error' || line.level === 'warning') {
                this.errorPositions[panel].push({
                    lineNumber: line.lineNumber,
                    level: line.level,
                    offset: this.logs[panel].currentOffset + index
                });
            }
        });
        
        // Update scrollbar indicators
        this.updateScrollbarIndicators(panel);
        this.updateErrorCount(panel);
    }

    // Debounce search to improve performance
    debounceSearch() {
        clearTimeout(this.debounceTimer);
        this.debounceTimer = setTimeout(() => {
            this.performGlobalSearch();
        }, 300);
    }

    debouncePanelSearch(panel, searchTerm) {
        clearTimeout(this.debounceTimer);
        this.debounceTimer = setTimeout(() => {
            this.performPanelSearch(panel, searchTerm);
        }, 300);
    }

    // Throttle scroll synchronization
    throttleScrollSync(scrolledElement) {
        if (!this.scrollSyncTimer) {
            this.scrollSyncTimer = setTimeout(() => {
                this.syncScrollPosition(scrolledElement);
                this.scrollSyncTimer = null;
            }, 16); // ~60fps
        }
    }

    handleScroll(element) {
        const panel = this.getPanelFromElement(element);
        if (!panel) return;
        
        const log = this.logs[panel];
        const scrollTop = element.scrollTop;
        const scrollHeight = element.scrollHeight;
        const clientHeight = element.clientHeight;
        
        // Sync scroll position to other panels if enabled
        if (this.syncScroll) {
            this.throttleScrollSync(element);
        }
        
        // Load more content when scrolling near bottom
        if (scrollTop + clientHeight > scrollHeight - 100) {
            const newOffset = log.currentOffset + log.visibleLines.length;
            if (newOffset < log.totalLines && !log.loading) {
                this.loadLogData(panel, newOffset);
            }
        }
    }

    getPanelFromElement(element) {
        for (const [panel, log] of Object.entries(this.logs)) {
            if (log.element === element) return panel;
        }
        return null;
    }

    handleFileUpload(panel, event) {
        const file = event.target.files[0];
        if (!file) return;

        // For now, we'll show a message that file uploads work with the default files
        this.showError('File uploads are currently limited to the default log files. The viewer is optimized for streaming large files.');
        
        // Update filename display
        const fileNameElement = document.getElementById(`${panel}FileName`);
        if (fileNameElement) {
            fileNameElement.textContent = file.name;
        }
    }

    renderLog(panel) {
        const log = this.logs[panel];
        const element = log.element;
        
        element.innerHTML = '';
        
        if (this.groupBySecond) {
            this.renderGroupedLog(panel);
        } else {
            this.renderUngroupedLog(panel);
        }

        if (this.autoScroll && log.visibleLines.length <= this.linesPerPage) {
            element.scrollTop = element.scrollHeight;
        }
    }

    renderGroupedLog(panel) {
        const log = this.logs[panel];
        const element = log.element;
        
        // Group visible lines by second
        const grouped = new Map();
        log.visibleLines.forEach(line => {
            if (line.secondKey) {
                if (!grouped.has(line.secondKey)) {
                    grouped.set(line.secondKey, []);
                }
                grouped.get(line.secondKey).push(line);
            }
        });
        
        const sortedKeys = Array.from(grouped.keys()).sort();
        const fragment = document.createDocumentFragment();
        
        sortedKeys.forEach(secondKey => {
            const events = grouped.get(secondKey);
            
            const groupHeader = document.createElement('div');
            groupHeader.className = 'log-group-header';
            groupHeader.dataset.secondKey = secondKey;
            groupHeader.innerHTML = `
                <div class="group-timestamp">${this.formatSecondKey(secondKey)}</div>
                <div class="group-count">${events.length} events</div>
            `;
            
            groupHeader.addEventListener('click', () => {
                this.selectSecond(secondKey);
            });
            
            fragment.appendChild(groupHeader);
            
            const eventsContainer = document.createElement('div');
            eventsContainer.className = 'log-group-events';
            eventsContainer.dataset.secondKey = secondKey;
            
            events.forEach(line => {
                const lineElement = this.createLogLineElement(line, secondKey);
                eventsContainer.appendChild(lineElement);
            });
            
            fragment.appendChild(eventsContainer);
        });
        
        element.appendChild(fragment);
    }

    renderUngroupedLog(panel) {
        const log = this.logs[panel];
        const element = log.element;
        const fragment = document.createDocumentFragment();
        
        log.visibleLines.forEach(line => {
            const lineElement = this.createLogLineElement(line, line.secondKey);
            fragment.appendChild(lineElement);
        });
        
        element.appendChild(fragment);
    }

    createLogLineElement(line, secondKey) {
        const lineElement = document.createElement('div');
        lineElement.className = `log-line ${line.level}`;
        lineElement.dataset.lineId = line.id;
        lineElement.dataset.secondKey = secondKey;
        
        let displayContent = line.content;
        if (!this.showTimestamps && line.timestamp) {
            displayContent = line.content.replace(line.timestamp, '').trim();
        }
        
        lineElement.textContent = displayContent;
        
        if (secondKey) {
            lineElement.addEventListener('click', () => {
                this.selectSecond(secondKey);
            });
        }
        
        return lineElement;
    }

    formatSecondKey(secondKey) {
        if (secondKey.includes('T')) {
            return secondKey.replace('T', ' ');
        }
        return secondKey;
    }

    selectSecond(secondKey) {
        this.clearSelection();
        this.selectedSecond = secondKey;
        this.selectedSecondSpan.textContent = `Selected: ${this.formatSecondKey(secondKey)}`;
        
        // Set flag to prevent sync scrolling conflicts
        this.isGroupSelectionActive = true;
        
        // Load and highlight the selected second across all panels
        this.loadAndHighlightSecond(secondKey);
    }

    async loadAndHighlightSecond(secondKey) {
        // Update status to show we're loading
        this.selectedSecondSpan.textContent = `Loading ${this.formatSecondKey(secondKey)}...`;
        
        // First, highlight what's already loaded
        Object.keys(this.logs).forEach(panel => {
            this.highlightSecondInPanel(panel, secondKey);
        });
        
        // Then load the second from all panels if not already loaded
        const loadResults = await Promise.all(
            Object.keys(this.logs).map(async panel => ({
                panel,
                loaded: await this.loadSecondFromPanel(panel, secondKey)
            }))
        );
        
        // Wait a bit for DOM to update, then scroll to loaded content
        setTimeout(() => {
            // Temporarily disable sync scrolling to prevent conflicts
            const wasSyncScrollEnabled = this.syncScroll;
            this.syncScroll = false;
            
            // Scroll all panels to the selected second simultaneously
            this.scrollAllPanelsToSecond(secondKey);
            
            // Re-enable sync scrolling after a delay
            setTimeout(() => {
                this.syncScroll = wasSyncScrollEnabled;
                this.isGroupSelectionActive = false;
            }, 1000);
            
            // Update status to show completion
            this.selectedSecondSpan.textContent = `Selected: ${this.formatSecondKey(secondKey)}`;
        }, 100);
    }

    async loadSecondFromPanel(panel, secondKey) {
        const log = this.logs[panel];
        
        // Check if this second is already loaded
        const isAlreadyLoaded = log.visibleLines.some(line => line.secondKey === secondKey);
        if (isAlreadyLoaded) {
            return;
        }
        
        // Show loading indicator
        this.showPanelLoading(panel, `Loading ${this.formatSecondKey(secondKey)}...`);
        
        // Load the second from the server
        try {
            const params = new URLSearchParams({
                panel: panel,
                second: secondKey,
                limit: 50
            });
            
            const response = await fetch(`/api/logs?${params}`);
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            
            const data = await response.json();
            
            if (data.lines && data.lines.length > 0) {
                // Add the new lines to the visible lines
                log.visibleLines = [...log.visibleLines, ...data.lines];
                
                // Update the second index
                this.updateSecondIndex(panel, data.lines);
                
                // Re-render the panel
                this.renderLog(panel);
                
                // Highlight the newly loaded second
                this.highlightSecondInPanel(panel, secondKey);
                
                // Return true to indicate content was loaded
                return true;
            }
        } catch (error) {
            console.error(`Error loading second ${secondKey} from panel ${panel}:`, error);
            this.showPanelError(panel, `Failed to load ${this.formatSecondKey(secondKey)}`);
        } finally {
            this.hidePanelLoading(panel);
        }
        
        return false;
    }

    showPanelLoading(panel, message) {
        const log = this.logs[panel];
        const element = log.element;
        
        // Add loading indicator at the bottom
        const loadingDiv = document.createElement('div');
        loadingDiv.className = 'panel-loading';
        loadingDiv.innerHTML = `
            <div class="loading-spinner-small"></div>
            <span>${message}</span>
        `;
        loadingDiv.id = `${panel}-loading`;
        element.appendChild(loadingDiv);
    }

    hidePanelLoading(panel) {
        const loadingDiv = document.getElementById(`${panel}-loading`);
        if (loadingDiv) {
            loadingDiv.remove();
        }
    }

    showPanelError(panel, message) {
        const log = this.logs[panel];
        const element = log.element;
        
        // Add error indicator
        const errorDiv = document.createElement('div');
        errorDiv.className = 'panel-error';
        errorDiv.innerHTML = `
            <i class="fas fa-exclamation-triangle"></i>
            <span>${message}</span>
        `;
        errorDiv.id = `${panel}-error`;
        element.appendChild(errorDiv);
        
        // Remove error after 3 seconds
        setTimeout(() => {
            const errorDiv = document.getElementById(`${panel}-error`);
            if (errorDiv) {
                errorDiv.remove();
            }
        }, 3000);
    }

    highlightSecondInPanel(panel, secondKey) {
        const log = this.logs[panel];
        const element = log.element;
        
        // Remove previous highlights
        element.querySelectorAll('.selected-second').forEach(el => {
            el.classList.remove('selected-second');
        });
        
        // Add highlights to group headers and events
        element.querySelectorAll(`[data-second-key="${secondKey}"]`).forEach(el => {
            el.classList.add('selected-second');
        });
    }

    scrollAllPanelsToSecond(secondKey) {
        // Calculate target positions for all panels first
        const panelScrollTargets = {};
        
        Object.keys(this.logs).forEach(panel => {
            const log = this.logs[panel];
            const element = log.element;
            
            // Try to find the group header first
            let targetElement = element.querySelector(`[data-second-key="${secondKey}"].log-group-header`);
            
            // If no group header, try any element with that second key
            if (!targetElement) {
                targetElement = element.querySelector(`[data-second-key="${secondKey}"]`);
            }
            
            if (targetElement) {
                // Calculate the target scroll position
                const elementRect = targetElement.getBoundingClientRect();
                const containerRect = element.getBoundingClientRect();
                const targetScrollTop = element.scrollTop + elementRect.top - containerRect.top - (containerRect.height / 2);
                
                panelScrollTargets[panel] = {
                    element: targetElement,
                    targetScrollTop: Math.max(0, targetScrollTop)
                };
            }
        });
        
        // Scroll all panels simultaneously using requestAnimationFrame for smooth animation
        // Use a single animation frame to ensure perfect synchronization
        const animationStartTime = performance.now();
        
        Object.keys(panelScrollTargets).forEach(panel => {
            const { element, targetScrollTop } = panelScrollTargets[panel];
            const log = this.logs[panel];
            
            // Use custom smooth scrolling for better control
            this.smoothScrollTo(log.element, targetScrollTop, animationStartTime);
            
            // Add a brief flash effect to draw attention
            element.style.transition = 'background-color 0.3s ease';
            element.style.backgroundColor = '#fef3c7';
            setTimeout(() => {
                element.style.backgroundColor = '';
            }, 1000);
        });
    }

    smoothScrollTo(element, targetScrollTop, startTimeOverride = null) {
        const startScrollTop = element.scrollTop;
        const distance = targetScrollTop - startScrollTop;
        
        // If the distance is very small, don't animate
        if (Math.abs(distance) < 10) {
            element.scrollTop = targetScrollTop;
            return;
        }
        
        const duration = Math.min(800, Math.abs(distance) * 2); // Adaptive duration based on distance
        let startTime = startTimeOverride;

        function animate(currentTime) {
            if (startTime === null) startTime = currentTime;
            const timeElapsed = currentTime - startTime;
            const progress = Math.min(timeElapsed / duration, 1);
            
            // Easing function for smooth deceleration
            const easeOutQuart = 1 - Math.pow(1 - progress, 4);
            
            element.scrollTop = startScrollTop + (distance * easeOutQuart);
            
            if (progress < 1) {
                requestAnimationFrame(animate);
            }
        }
        
        requestAnimationFrame(animate);
    }

    scrollToSecondInPanel(panel, secondKey) {
        const log = this.logs[panel];
        const element = log.element;
        
        // Try to find the group header first
        let targetElement = element.querySelector(`[data-second-key="${secondKey}"].log-group-header`);
        
        // If no group header, try any element with that second key
        if (!targetElement) {
            targetElement = element.querySelector(`[data-second-key="${secondKey}"]`);
        }
        
        if (targetElement) {
            // Calculate the target scroll position
            const elementRect = targetElement.getBoundingClientRect();
            const containerRect = element.getBoundingClientRect();
            const targetScrollTop = element.scrollTop + elementRect.top - containerRect.top - (containerRect.height / 2);
            
            // Use custom smooth scrolling for better control
            this.smoothScrollTo(element, Math.max(0, targetScrollTop));
            
            // Add a brief flash effect to draw attention
            targetElement.style.transition = 'background-color 0.3s ease';
            targetElement.style.backgroundColor = '#fef3c7';
            setTimeout(() => {
                targetElement.style.backgroundColor = '';
            }, 1000);
        } else {
            console.log(`Could not find element for second ${secondKey} in panel ${panel}`);
        }
    }

    clearSelection() {
        this.selectedSecond = null;
        this.selectedSecondSpan.textContent = 'Selected: None';
        this.isGroupSelectionActive = false;
        
        // Remove highlights from all panels
        Object.keys(this.logs).forEach(panel => {
            const log = this.logs[panel];
            log.element.querySelectorAll('.selected-second').forEach(el => {
                el.classList.remove('selected-second');
            });
        });
    }

    redrawAllLogs() {
        Object.keys(this.logs).forEach(panel => {
            if (this.logs[panel].visibleLines.length > 0) {
                this.renderLog(panel);
            }
        });
    }

    async performGlobalSearch() {
        if (!this.currentSearch.trim()) {
            this.clearAllHighlights();
            return;
        }

        try {
            const response = await fetch(`/api/search?q=${encodeURIComponent(this.currentSearch)}`);
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            
            const results = await response.json();
            let totalResults = 0;

            Object.keys(this.logs).forEach(panel => {
                const log = this.logs[panel];
                log.searchResults = results[panel] || [];
                totalResults += log.searchResults.length;
                this.highlightSearchResults(panel);
            });

            this.searchResultsSpan.textContent = `Search results: ${totalResults}`;
        } catch (error) {
            console.error('Error performing global search:', error);
        }
    }

    async performPanelSearch(panel, searchTerm) {
        if (!searchTerm.trim()) {
            this.clearPanelHighlights(panel);
            return;
        }

        // Load filtered data from server
        await this.loadLogData(panel, 0, searchTerm);
    }

    highlightSearchResults(panel) {
        const log = this.logs[panel];
        const element = log.element;
        
        element.querySelectorAll('.search-match').forEach(el => {
            el.classList.remove('search-match');
        });

        log.searchResults.forEach(result => {
            const lineElement = element.querySelector(`[data-line-id="${result.id}"]`);
            if (lineElement) {
                lineElement.classList.add('search-match');
                lineElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
        });
    }

    clearPanelSearch(panel) {
        const searchInput = document.querySelector(`[data-panel="${panel}"]`);
        if (searchInput) {
            searchInput.value = '';
        }
        this.clearPanelHighlights(panel);
        // Reload original data
        this.loadLogData(panel, 0);
    }

    clearPanelHighlights(panel) {
        const log = this.logs[panel];
        log.element.querySelectorAll('.search-match').forEach(el => {
            el.classList.remove('search-match');
        });
    }

    clearAllHighlights() {
        Object.keys(this.logs).forEach(panel => {
            this.clearPanelHighlights(panel);
        });
        this.searchResultsSpan.textContent = 'Search results: 0';
    }

    syncScrollPosition(scrolledElement) {
        if (!this.syncScroll || this.isGroupSelectionActive) return;
        
        const scrollTop = scrolledElement.scrollTop;
        const scrollHeight = scrolledElement.scrollHeight;
        const clientHeight = scrolledElement.clientHeight;
        
        // Calculate scroll percentage (0-1)
        const scrollPercentage = scrollTop / Math.max(1, scrollHeight - clientHeight);

        Object.values(this.logs).forEach(log => {
            if (log.element !== scrolledElement && log.element.scrollHeight > 0) {
                const targetScrollTop = scrollPercentage * (log.element.scrollHeight - log.element.clientHeight);
                
                // Prevent infinite scroll loops by checking if the change is significant
                const currentScrollTop = log.element.scrollTop;
                const scrollDiff = Math.abs(targetScrollTop - currentScrollTop);
                
                if (scrollDiff > 1) { // Only sync if difference is more than 1px
                    // Use requestAnimationFrame for smooth scrolling
                    requestAnimationFrame(() => {
                        log.element.scrollTop = targetScrollTop;
                    });
                }
            }
        });
    }

    updateStatus() {
        const totalLines = Object.values(this.stats).reduce((sum, stat) => {
            return sum + (stat.totalLines || 0);
        }, 0);
        this.totalLinesSpan.textContent = `Total lines: ${totalLines.toLocaleString()}`;
    }

    exportLogs() {
        // For now, export the visible content
        const exportData = {};
        Object.keys(this.logs).forEach(panel => {
            const log = this.logs[panel];
            exportData[panel] = log.visibleLines.map(line => line.original);
        });

        const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `ct_logs_export_${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    showLoadingOverlay(message = 'Loading...') {
        const overlay = document.getElementById('loadingOverlay');
        const status = document.getElementById('loadingStatus');
        if (overlay && status) {
            status.textContent = message;
            overlay.style.display = 'flex';
        }
    }

    hideLoadingOverlay() {
        const overlay = document.getElementById('loadingOverlay');
        if (overlay) {
            overlay.style.display = 'none';
        }
    }

    updateLoadingProgress(percent) {
        const progressFill = document.getElementById('progressFill');
        const progressText = document.getElementById('progressText');
        if (progressFill && progressText) {
            progressFill.style.width = `${percent}%`;
            progressText.textContent = `${percent}%`;
        }
    }

    updateLoadingStatus(message) {
        const status = document.getElementById('loadingStatus');
        if (status) {
            status.textContent = message;
        }
    }

    getPanelName(panel) {
        const names = {
            bt: 'BodyTom Scanner',
            out: 'Osiris Communication',
            rs: 'ReconServer'
        };
        return names[panel] || panel;
    }

    showError(message) {
        this.showNotification(message, 'error');
    }

    showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        const colors = {
            error: '#ef4444',
            success: '#10b981',
            info: '#3b82f6',
            warning: '#f59e0b'
        };
        
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: ${colors[type] || colors.info};
            color: white;
            padding: 1rem;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            z-index: 1000;
            max-width: 400px;
            font-size: 0.875rem;
            animation: slideIn 0.3s ease-out;
        `;
        notification.textContent = message;
        document.body.appendChild(notification);
        
        setTimeout(() => {
            if (notification.parentNode) {
                notification.remove();
            }
        }, 3000);
    }

    // File Upload Methods
    initFileUpload() {
        const uploadBtn = document.getElementById('uploadBtn');
        const uploadModal = document.getElementById('uploadModal');
        const closeUploadModal = document.getElementById('closeUploadModal');
        const fileUpload = document.getElementById('fileUpload');
        const uploadFilesBtn = document.getElementById('uploadFilesBtn');
        const uploadDropZone = document.getElementById('uploadDropZone');

        if (uploadBtn) {
            uploadBtn.addEventListener('click', () => {
                this.showUploadModal();
            });
        }

        if (closeUploadModal) {
            closeUploadModal.addEventListener('click', () => {
                this.hideUploadModal();
            });
        }

        if (fileUpload) {
            fileUpload.addEventListener('change', (e) => {
                this.handleFileSelection(e.target.files);
            });
        }

        if (uploadFilesBtn) {
            uploadFilesBtn.addEventListener('click', () => {
                this.uploadSelectedFiles();
            });
        }

        // Drag and drop functionality
        if (uploadDropZone) {
            uploadDropZone.addEventListener('dragover', (e) => {
                e.preventDefault();
                uploadDropZone.classList.add('dragover');
            });

            uploadDropZone.addEventListener('dragleave', () => {
                uploadDropZone.classList.remove('dragover');
            });

            uploadDropZone.addEventListener('drop', (e) => {
                e.preventDefault();
                uploadDropZone.classList.remove('dragover');
                this.handleFileSelection(e.dataTransfer.files);
            });

            uploadDropZone.addEventListener('click', () => {
                fileUpload.click();
            });
        }

        // Load available files on modal open
        this.loadAvailableFiles();
    }

    showUploadModal() {
        const modal = document.getElementById('uploadModal');
        if (modal) {
            modal.style.display = 'flex';
            this.loadAvailableFiles();
        }
    }

    hideUploadModal() {
        const modal = document.getElementById('uploadModal');
        if (modal) {
            modal.style.display = 'none';
        }
    }

    handleFileSelection(files) {
        const uploadFilesBtn = document.getElementById('uploadFilesBtn');
        if (files.length > 0) {
            uploadFilesBtn.disabled = false;
            uploadFilesBtn.textContent = `Upload ${files.length} File${files.length > 1 ? 's' : ''}`;
        } else {
            uploadFilesBtn.disabled = true;
            uploadFilesBtn.textContent = 'Upload Files';
        }
    }

    async uploadSelectedFiles() {
        const fileUpload = document.getElementById('fileUpload');
        const files = fileUpload.files;
        
        if (files.length === 0) return;

        this.showLoadingOverlay('Uploading files...');
        
        try {
            for (let i = 0; i < files.length; i++) {
                const file = files[i];
                const progress = ((i + 1) / files.length) * 100;
                this.updateLoadingProgress(progress);
                this.updateLoadingStatus(`Uploading ${file.name}...`);

                await this.uploadFile(file);
            }

            this.showNotification('Files uploaded successfully!', 'success');
            this.loadAvailableFiles();
            this.hideUploadModal();
            
            // Refresh the log viewer with new files
            this.loadLogs();
            
        } catch (error) {
            this.showError(`Upload failed: ${error.message}`);
        } finally {
            this.hideLoadingOverlay();
            fileUpload.value = ''; // Clear file input
            this.handleFileSelection([]);
        }
    }

    async uploadFile(file) {
        const formData = new FormData();
        formData.append('file', file);

        const response = await fetch('/api/upload', {
            method: 'POST',
            body: formData
        });

        if (!response.ok) {
            const error = await response.text();
            throw new Error(error);
        }

        const result = await response.json();
        return result;
    }

    async loadAvailableFiles() {
        const fileList = document.getElementById('fileList');
        if (!fileList) return;

        try {
            const response = await fetch('/api/files');
            if (!response.ok) {
                throw new Error('Failed to load files');
            }

            const data = await response.json();
            this.renderFileList(data.files);
        } catch (error) {
            fileList.innerHTML = `<div class="error">Error loading files: ${error.message}</div>`;
        }
    }

    renderFileList(files) {
        const fileList = document.getElementById('fileList');
        if (!fileList) return;

        if (files.length === 0) {
            fileList.innerHTML = '<div class="no-files">No log files found. Upload some files to get started!</div>';
            return;
        }

        const fileItems = files.map(file => {
            const size = this.formatFileSize(file.size);
            const lines = file.totalLines.toLocaleString();
            
            return `
                <div class="file-item">
                    <div class="file-info">
                        <div class="file-name">${file.filename}</div>
                        <div class="file-stats">
                            ${size} • ${lines} lines
                            ${file.levelCounts.error > 0 ? `• ${file.levelCounts.error} errors` : ''}
                            ${file.levelCounts.warning > 0 ? `• ${file.levelCounts.warning} warnings` : ''}
                        </div>
                    </div>
                    <div class="file-actions">
                        <button class="btn-remove" onclick="ctViewer.removeFile('${file.filename}')">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </div>
            `;
        }).join('');

        fileList.innerHTML = fileItems;
    }

    formatFileSize(bytes) {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
    }

    async removeFile(filename) {
        if (!confirm(`Are you sure you want to delete ${filename}?`)) {
            return;
        }

        try {
            // Note: We'll need to add a DELETE endpoint to the server for this
            // For now, we'll just show a message
            this.showNotification(`File deletion not yet implemented. You can manually delete ${filename} from the data/ folder.`, 'warning');
        } catch (error) {
            this.showError(`Failed to remove file: ${error.message}`);
        }
    }
}

// Initialize the viewer when the page loads
document.addEventListener('DOMContentLoaded', () => {
    window.ctViewer = new CTLogViewer();
}); 