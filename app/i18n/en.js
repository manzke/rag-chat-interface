export default {
    time: {
        justNow: 'just now',
        minutesAgo: '{count}m ago',
        hoursAgo: '{count}h ago',
        yesterday: 'yesterday',
        daysAgo: '{count}d ago',
        today: 'Today',
        yesterday: 'Yesterday',
    },
    welcome: {
        title: 'Choose your Assistant',
        subtitle: 'Select an assistant to help you with your questions'
    },
    chat: {
        placeholder: 'Type your message here...',
        status: {
            ready: 'Ready',
            connecting: 'Connecting...',
            receiving: 'Receiving answer...',
            stopping: 'Stopping...'
        },
        actions: {
            send: 'Send message',
            stop: 'Stop response',
            back: 'Back to Assistant Selection',
            voiceInput: 'Voice Input (Ctrl+M)',
            expertMode: 'Expert Mode',
            clearChat: 'Clear chat',
            exportChat: 'Export chat',
            closeWidget: 'Close Widget'
        },
        voice: {
            listening: 'Listening...',
            instructions: 'Click microphone or press Ctrl+M to stop'
        },
        expertMode: {
            title: 'Expert Mode',
            docIds: 'Document IDs (comma-separated)',
            query: 'Search Query',
            profileName: 'Profile Name',
            profileId: 'Profile ID (base64)',
            filters: 'Filters (JSON)',
            invalidJson: 'Invalid JSON format',
            cancel: 'Cancel',
            save: 'Save'
        },
        sources: {
            title: 'Sources',
            search: 'Search in passages...',
            sortBy: 'Sort by',
            sortOptions: {
                relevance: 'Relevance',
                date: 'Date',
                title: 'Title'
            },
            filters: {
                highRelevance: 'High Relevance Only',
                clickableLinks: 'Clickable Links'
            },
            noResults: 'No matching passages found',
            viewSource: 'View Source',
            metadata: 'Metadata',
            showMore: 'Show More Sources ({count})'
        },
        feedback: {
            helpful: 'Helpful',
            notHelpful: 'Not helpful',
            copied: 'Copied to clipboard!'
        }
    },
    errors: {
        loading: {
            title: 'Error Loading Configuration',
            message: 'Please try refreshing the page. If the problem persists, contact support.'
        }
    }
};