// Fitur 01 (Dashboard Kendaraan): total aset, kendaraan sedang dipakai, status kondisi, aset terbaru,
// ditambah pengingat (fitur 07): servis, dokumen STNK/pajak, dan data yang lama tidak diperbarui.
import { send } from '../http.js';
import { today } from '../../shared/validation.js';
import { KONDISI } from '../../shared/enums.js';
import { jadwalServis } from './perawatan.js';
import { getSettings } from './pengaturan.js';

const DOKUMEN_HARI = 30; // STNK/pajak yang habis dalam 30 hari ditandai

export function register(app, { db }) {
  app.get('/api/v1/dashboard', (req, res) => {
    const settings = getSettings(db);
    const now = today();

    // Total & kondisi dihitung dari kendaraan aktif yang sama → jumlah kategori = total aset.
    const total = db.prepare('SELECT COUNT(*) AS n FROM kdo WHERE is_aktif = 1').get().n;
    const perKondisi = Object.fromEntries(KONDISI.map((k) => [k.value, 0]));
    for (const r of db.prepare('SELECT kondisi, COUNT(*) AS n FROM kdo WHERE is_aktif = 1 GROUP BY kondisi').all()) {
      perKondisi[r.kondisi] = r.n;
    }

    const sedangDipakai = db.prepare(`
      SELECT k.id AS kdo_id, k.nomor_polisi, k.merek, k.tipe, k.kondisi, pk.id AS pemakaian_id,
        pk.pns_id, pk.pns_nama, pk.tanggal_mulai, pd.singkatan AS perangkat_daerah_singkatan
      FROM kdo_pemakaian pk JOIN kdo k ON k.id = pk.kdo_id JOIN perangkat_daerah pd ON pd.id = k.perangkat_daerah_id
      WHERE pk.status = 'aktif' ORDER BY pk.tanggal_mulai DESC`).all();

    const asetTerbaru = db.prepare(`
      SELECT k.id, k.nomor_polisi, k.merek, k.tipe, k.kondisi, k.created_at, pd.singkatan AS perangkat_daerah_singkatan
      FROM kdo k JOIN perangkat_daerah pd ON pd.id = k.perangkat_daerah_id
      ORDER BY k.created_at DESC, k.id DESC LIMIT 5`).all();

    const dokumen = db.prepare(`
      SELECT id, nomor_polisi, merek, tipe, masa_berlaku_stnk, tanggal_pajak FROM kdo
      WHERE is_aktif = 1 AND (masa_berlaku_stnk <= date(?, '+${DOKUMEN_HARI} days') OR tanggal_pajak <= date(?, '+${DOKUMEN_HARI} days'))
      ORDER BY MIN(COALESCE(masa_berlaku_stnk, '9999'), COALESCE(tanggal_pajak, '9999'))`).all(now, now);

    const perluPembaruan = db.prepare(`
      SELECT id, nomor_polisi, merek, tipe, updated_at FROM kdo
      WHERE is_aktif = 1 AND date(updated_at) <= date(?, ?) ORDER BY updated_at`)
      .all(now, `-${settings.pengingat_pembaruan_hari} days`);

    send(res, {
      total_aset: total,
      total_nonaktif: db.prepare('SELECT COUNT(*) AS n FROM kdo WHERE is_aktif = 0').get().n,
      kondisi: perKondisi,
      sedang_dipakai: sedangDipakai,
      aset_terbaru: asetTerbaru,
      pengingat: {
        servis: jadwalServis(db, { hanyaPerluServis: true }),
        dokumen,
        pembaruan_data: perluPembaruan,
      },
    }, { meta: { tanggal: now, pengingat_servis_hari: settings.pengingat_servis_hari, pengingat_pembaruan_hari: settings.pengingat_pembaruan_hari } });
  });
}
