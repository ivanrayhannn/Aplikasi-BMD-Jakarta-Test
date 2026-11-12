import { test } from 'node:test';
import assert from 'node:assert/strict';
import { schemas, validate } from '../src/shared/validation.js';

test('normalisasi nomor polisi & nilai bawaan', () => {
  const { data, errors } = validate(schemas.kdo, {
    nomor_polisi: ' b  1234   abc ', merek: 'Toyota', tahun_produksi: '2020', jenis_kendaraan: 'roda_4',
    nomor_rangka: 'abc', nomor_mesin: 'def', perangkat_daerah_id: '1', nilai_perolehan: '1000.555',
  });
  assert.equal(errors, null);
  assert.equal(data.nomor_polisi, 'B 1234 ABC');
  assert.equal(data.kondisi, 'baik');
  assert.equal(data.is_aktif, 1);
  assert.equal(data.nilai_perolehan, 1000.56);
  assert.equal(data.tipe, null);
});

test('pesan error per field', () => {
  const { errors } = validate(schemas.kdo, { nomor_polisi: '1234', tahun_produksi: 1979, kondisi: 'hancur' });
  assert.match(errors.nomor_polisi, /Format nomor polisi/);
  assert.match(errors.tahun_produksi, /minimal 1980/);
  assert.match(errors.kondisi, /tidak valid/);
  assert.match(errors.merek, /wajib diisi/);
});

test('NIP wajib 18 digit, spasi diabaikan', () => {
  assert.match(validate(schemas.pns, { nip: '12345' }).errors.nip, /18 digit/);
  assert.equal(validate(schemas.pns, { nip: '197801012005 011001' }).data.nip, '197801012005011001');
});

test('tanggal servis tidak boleh di masa depan', () => {
  const { errors } = validate(schemas.perawatan, { kdo_id: 1, tanggal_servis: '2999-01-01', jenis_perawatan: 'rutin', biaya: 0, kondisi_setelah: 'baik' });
  assert.match(errors.tanggal_servis, /melebihi hari ini/);
});
