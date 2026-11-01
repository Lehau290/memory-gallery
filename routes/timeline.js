/**
 * MEMORY GALLERY - Timeline Router (Node.js)
 */

const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { requireAuth } = require('../middleware/auth');

// GET /api/timeline
router.get('/', requireAuth, async (req, res) => {
    try {
        const yearFilter = req.query.year ? parseInt(req.query.year) : null;

        const yearRows = await db.allAsync(`
            SELECT DISTINCT strftime('%Y', memory_date) as year 
            FROM memories 
            WHERE user_id = ? AND memory_date IS NOT NULL 
            ORDER BY year DESC
        `, [req.user.id]);
        const availableYears = yearRows.map(r => r.year).filter(Boolean);

        const where = ['user_id = ?'];
        const params = [req.user.id];

        if (yearFilter) {
            where.push("strftime('%Y', memory_date) = ?");
            params.push(String(yearFilter));
        }

        const sql = `
            SELECT id, title, description, file_path, file_name, file_type, memory_date, location, is_favorite, duration 
            FROM memories 
            WHERE ${where.join(' AND ')} 
            ORDER BY memory_date DESC, id DESC
        `;
        const memories = await db.allAsync(sql, params);

        // Group by Year -> Month
        const grouped = {};
        for (const m of memories) {
            const d = new Date(m.memory_date);
            const y = d.getFullYear() || m.memory_date.substring(0, 4);
            const mNum = String(d.getMonth() + 1).padStart(2, '0');
            const mName = `Tháng ${mNum}`;

            if (!grouped[y]) {
                grouped[y] = {
                    year: String(y),
                    total: 0,
                    months: {}
                };
            }
            if (!grouped[y].months[mNum]) {
                grouped[y].months[mNum] = {
                    month: mNum,
                    month_name: mName,
                    total: 0,
                    items: []
                };
            }
            grouped[y].total++;
            grouped[y].months[mNum].total++;
            grouped[y].months[mNum].items.push(m);
        }

        const timeline = Object.values(grouped).map(yGroup => {
            return {
                ...yGroup,
                months: Object.values(yGroup.months)
            };
        });

        res.json({
            available_years: availableYears,
            selected_year: yearFilter,
            total_memories: memories.length,
            timeline
        });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

module.exports = router;

