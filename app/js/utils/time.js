/**
 * Format a date to relative time (e.g., "2 mins ago")
 * @param {Date|string|number} date - The date to format
 * @returns {string} The relative time string
 */
export function getRelativeTime(date) {
    const now = new Date();
    const messageDate = new Date(date);
    const diffInSeconds = Math.floor((now - messageDate) / 1000);
    const diffInMinutes = Math.floor(diffInSeconds / 60);
    const diffInHours = Math.floor(diffInMinutes / 60);
    const diffInDays = Math.floor(diffInHours / 24);

    if (diffInSeconds < 60) {
        return 'just now';
    } else if (diffInMinutes < 60) {
        return `${diffInMinutes}m ago`;
    } else if (diffInHours < 24) {
        return `${diffInHours}h ago`;
    } else if (diffInDays === 1) {
        return 'yesterday';
    } else if (diffInDays < 7) {
        return `${diffInDays}d ago`;
    } else {
        return messageDate.toLocaleDateString();
    }
}

/**
 * Format a date to absolute time (e.g., "Feb 25, 2024, 8:30 PM")
 * @param {Date|string|number} date - The date to format
 * @returns {string} The absolute time string
 */
export function getAbsoluteTime(date) {
    const messageDate = new Date(date);
    return messageDate.toLocaleString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: 'numeric'
    });
}

/**
 * Check if two dates are on different days
 * @param {Date|string|number} date1 - First date
 * @param {Date|string|number} date2 - Second date
 * @returns {boolean} True if dates are on different days
 */
export function isDifferentDay(date1, date2) {
    const d1 = new Date(date1);
    const d2 = new Date(date2);
    return d1.toDateString() !== d2.toDateString();
}

/**
 * Format a date for the date separator
 * @param {Date|string|number} date - The date to format
 * @returns {string} The formatted date string
 */
export function getDateSeparatorText(date) {
    const messageDate = new Date(date);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (messageDate.toDateString() === today.toDateString()) {
        return 'Today';
    } else if (messageDate.toDateString() === yesterday.toDateString()) {
        return 'Yesterday';
    } else {
        return messageDate.toLocaleDateString(undefined, {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
    }
}