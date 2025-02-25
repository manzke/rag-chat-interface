export default {
    time: {
        justNow: 'gerade eben',
        minutesAgo: 'vor {count}m',
        hoursAgo: 'vor {count}h',
        yesterday: 'gestern',
        daysAgo: 'vor {count}d',
        today: 'Heute',
        yesterday: 'Gestern',
    },
    welcome: {
        title: 'Wählen Sie Ihren Assistenten',
        subtitle: 'Wählen Sie einen Assistenten, der Ihnen bei Ihren Fragen hilft'
    },
    chat: {
        placeholder: 'Geben Sie Ihre Nachricht hier ein...',
        status: {
            ready: 'Bereit',
            connecting: 'Verbinde...',
            receiving: 'Empfange Antwort...',
            stopping: 'Stoppe...'
        },
        actions: {
            send: 'Nachricht senden',
            stop: 'Antwort stoppen',
            back: 'Zurück zur Assistentenauswahl',
            voiceInput: 'Spracheingabe (Strg+M)',
            expertMode: 'Expertenmodus',
            clearChat: 'Chat löschen',
            exportChat: 'Chat exportieren',
            closeWidget: 'Widget schließen'
        },
        voice: {
            listening: 'Höre zu...',
            instructions: 'Klicken Sie auf das Mikrofon oder drücken Sie Strg+M zum Beenden'
        },
        expertMode: {
            title: 'Expertenmodus',
            docIds: 'Dokument-IDs (kommagetrennt)',
            query: 'Suchanfrage',
            profileName: 'Profilname',
            profileId: 'Profil-ID (base64)',
            filters: 'Filter (JSON)',
            invalidJson: 'Ungültiges JSON-Format',
            cancel: 'Abbrechen',
            save: 'Speichern'
        },
        sources: {
            title: 'Quellen',
            search: 'In Passagen suchen...',
            sortBy: 'Sortieren nach',
            sortOptions: {
                relevance: 'Relevanz',
                date: 'Datum',
                title: 'Titel'
            },
            filters: {
                highRelevance: 'Nur hohe Relevanz',
                clickableLinks: 'Anklickbare Links'
            },
            noResults: 'Keine passenden Passagen gefunden',
            viewSource: 'Quelle anzeigen',
            metadata: 'Metadaten',
            showMore: 'Weitere Quellen anzeigen ({count})'
        },
        feedback: {
            helpful: 'Hilfreich',
            notHelpful: 'Nicht hilfreich',
            copied: 'In die Zwischenablage kopiert!'
        }
    },
    errors: {
        loading: {
            title: 'Fehler beim Laden der Konfiguration',
            message: 'Bitte laden Sie die Seite neu. Wenn das Problem weiterhin besteht, kontaktieren Sie den Support.'
        }
    }
};