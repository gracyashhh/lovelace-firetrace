import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
export class Budget {
    db;
    constructor(path) { mkdirSync(dirname(path), { recursive: true }); this.db = new DatabaseSync(path); this.db.exec('PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000; CREATE TABLE IF NOT EXISTS usage(id INTEGER PRIMARY KEY, session TEXT, phase TEXT, reserved REAL, charged REAL, input_tokens INTEGER, output_tokens INTEGER, status TEXT, created INTEGER); CREATE TABLE IF NOT EXISTS requests(session TEXT, ip TEXT, created INTEGER); CREATE TABLE IF NOT EXISTS cache(key TEXT PRIMARY KEY, value TEXT, created INTEGER);'); }
    status(total = 30, dev = 10) { const spent = Number(this.db.prepare('SELECT COALESCE(SUM(COALESCE(charged,reserved)),0) AS n FROM usage').get().n), development = Number(this.db.prepare("SELECT COALESCE(SUM(COALESCE(charged,reserved)),0) AS n FROM usage WHERE phase='development'").get().n); return { spent, development, totalLimit: total, developmentLimit: dev, remaining: Math.max(0, total - spent), developmentRemaining: Math.max(0, dev - development) }; }
    limit(session, ip, sessionMax = 100, rpm = 12) { const now = Date.now(); this.db.exec('BEGIN IMMEDIATE'); try {
        let sessionN = Number(this.db.prepare('SELECT COUNT(*) n FROM requests WHERE session=?').get(session).n), recent = Number(this.db.prepare('SELECT COUNT(*) n FROM requests WHERE ip=? AND created>?').get(ip, now - 60000).n);
        if (sessionN >= sessionMax || recent >= rpm)
            throw Error('Request limit reached.');
        this.db.prepare('INSERT INTO requests VALUES(?,?,?)').run(session, ip, now);
        this.db.exec('COMMIT');
    }
    catch (e) {
        this.db.exec('ROLLBACK');
        throw e;
    } }
    reserve(session, amount, phase, total = 30, dev = 10) { if (!Number.isFinite(amount) || amount <= 0)
        throw Error('Invalid reservation'); this.db.exec('BEGIN IMMEDIATE'); try {
        const s = this.status(total, dev);
        if (s.spent + amount > total || phase === 'development' && s.development + amount > dev)
            throw Error('Paid budget ceiling reached.');
        const r = this.db.prepare('INSERT INTO usage(session,phase,reserved,status,created) VALUES(?,?,?,?,?)').run(session, phase, amount, 'reserved', Date.now());
        this.db.exec('COMMIT');
        return Number(r.lastInsertRowid);
    }
    catch (e) {
        this.db.exec('ROLLBACK');
        throw e;
    } }
    settle(id, input, output, rateIn, rateOut) { const row = this.db.prepare('SELECT reserved FROM usage WHERE id=?').get(id); if (!row)
        throw Error('Unknown reservation'); let charge = (input * rateIn + output * rateOut) / 1e6; if (![input, output, charge].every(Number.isFinite) || input < 0 || output < 0 || !Number.isInteger(input) || !Number.isInteger(output))
        throw Error('Invalid usage'); this.db.prepare('UPDATE usage SET charged=?,input_tokens=?,output_tokens=?,status=? WHERE id=?').run(Math.max(charge, 0), input, output, charge > row.reserved ? 'over_reservation' : 'settled', id); if (charge > row.reserved)
        throw Error('Usage exceeded conservative reservation; disable paid requests and audit.'); }
    unsafe() { return !!this.db.prepare("SELECT id FROM usage WHERE status='over_reservation' LIMIT 1").get(); }
    cacheGet(key) { const row = this.db.prepare('SELECT value FROM cache WHERE key=? AND created>?').get(key, Date.now() - 86400000); return row ? JSON.parse(row.value) : null; }
    cacheSet(key, value) { this.db.prepare('INSERT OR REPLACE INTO cache VALUES(?,?,?)').run(key, JSON.stringify(value), Date.now()); this.db.prepare('DELETE FROM cache WHERE created<?').run(Date.now() - 86400000); }
    close() { this.db.close(); }
}
