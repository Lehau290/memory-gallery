/**
 * MEMORY GALLERY - On This Day Router (Node.js)
 */

const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { requireAuth, formatBytes } = require('../middleware/auth');

// GET /api/on-this-day
router.get('/', requireAuth, async (req, res) => {
    try {
        const reqDate = req.query.date ? new Date(req.query.date) : new Date();
        const mm = String(reqDate.getMonth() + 1).padStart(2, '0');
        const dd = String(reqDate.getDate()).padStart(2, '0');
        const currentMonthDay = `${mm}-${dd}`;
        const currentYear = reqDate.getFullYear();

        const sql = `
            SELECT m.*, a.title as album_title 
            FROM memories m 
            LEFT JOIN albums a ON m.album_id = a.id 
            WHERE m.user_id = ? 
            AND (strftime('%m-%d', m.memory_date) = ? OR strftime('%m-%d', m.created_at) = ?)
            AND (strftime('%Y', m.memory_date) < ? OR strftime('%Y', m.created_at) < ?)
            ORDER BY m.memory_date DESC
        `;

        const memories = await db.allAsync(sql, [req.user.id, currentMonthDay, currentMonthDay, String(currentYear), String(currentYear)]);

        const grouped = {};
        for (const m of memories) {
            m.formatted_size = formatBytes(m.file_size);
            const mYear = parseInt(m.memory_date.substring(0, 4));
            const yearsAgo = Math.max(1, currentYear - mYear);
            const label = yearsAgo === 1 ? `1 năm trước (${mYear})` : `${yearsAgo} năm trước (${mYear})`;

            if (!grouped[mYear]) {
                grouped[mYear] = {
                    year: mYear,
                    years_ago: yearsAgo,
                    label,
                    memories: []
                };
            }
            grouped[mYear].memories.push(m);
        }

        const sortedGroups = Object.keys(grouped)
            .sort((a, b) => b - a)
            .map(y => grouped[y]);

        res.json({
            target_date: reqDate.toISOString().split('T')[0],
            formatted_date: `Ngày ${dd}/${mm}`,
            has_memories: memories.length > 0,
            total_memories: memories.length,
            groups: sortedGroups
        });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

module.exports = router;

