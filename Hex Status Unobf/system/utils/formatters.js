class TimeFormatter {
    static formatUptime(uptime) {
        const intervals = [
            { label: 'd', seconds: 86400 },
            { label: 'h', seconds: 3600 },
            { label: 'm', seconds: 60 },
            { label: 's', seconds: 1 }
        ];

        return intervals
            .map(interval => {
                const value = Math.floor(uptime / interval.seconds);
                uptime %= interval.seconds;
                return value ? `${value}${interval.label}` : '';
            })
            .filter(Boolean)
            .join(' ') || '0s';
    }

    static formatDate(date) {
        return new Date(date).toLocaleString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    }

    static formatDuration(ms) {
        if (ms < 1000) return `${ms}ms`;
        return `${(ms / 1000).toFixed(2)}s`;
    }
}

class DataFormatter {
    static formatBytes(bytes, decimals = 2) {
        if (!bytes) return '0 Bytes';

        const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB'];
        const k = 1024;
        const dm = decimals < 0 ? 0 : decimals;
        const i = Math.floor(Math.log(bytes) / Math.log(k));

        return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
    }

    static formatNumber(number) {
        return new Intl.NumberFormat('en-US').format(number);
    }

    static formatPercentage(value, total) {
        return `${((value / total) * 100).toFixed(1)}%`;
    }
}

class StatusFormatter {
    static formatStatus(status) {
        const statusMap = {
            online: '🟢 Online',
            offline: '🔴 Offline',
            degraded: '🟡 Degraded',
            maintenance: '🟠 Maintenance'
        };
        return statusMap[status.toLowerCase()] || status;
    }

    static formatResponseCode(code) {
        if (code >= 500) return '🔴 Server Error';
        if (code >= 400) return '🟡 Client Error';
        if (code >= 300) return '🟣 Redirect';
        if (code >= 200) return '🟢 Success';
        return '⚪ Unknown';
    }
}

module.exports = {
    ...TimeFormatter,
    ...DataFormatter,
    ...StatusFormatter,
    formatUptime: TimeFormatter.formatUptime,
    formatBytes: DataFormatter.formatBytes
};
