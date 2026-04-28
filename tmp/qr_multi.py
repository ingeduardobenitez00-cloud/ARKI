
import zlib

samples = {
    'S1': '1C8104615000AA07477503554F7660900000CB393662789C013300CCFF00004B026AE5500CA926DAA5A682AA151191A2EB69969A28C68C14B4C3049C5981B15A65C89A48D450309899089E418780C5D03956179700EE61BC9724E64A',
    'S2': '1CDC47C419004E000000005CB59A81789C6360606260BFE6C1D8D3C06016C2680000143C02F0E002080D87B9037C',
    'S3': '1C03BE6DC4004A00000000FF35A7DA789C6360606260BFA6C6D8C160AC200C000BB601F5E002080D9B001843',
    'S4': '1C1C83551F005E000000005CB59A81789C63606062E08DCEB05FC2800498188802442A1BF48069C71200BC550318E002080D87B9037C',
    'S5': '1C17E9533E004E00000000FF35A7DA789C63606062E08D76B35FC23084016B880300322A022DE002080D9B001843',
}

all_data = {}
for name, hex_str in samples.items():
    b = bytes.fromhex(hex_str)
    zlib_pos = next(i for i in range(len(b)-1) if b[i]==0x78 and b[i+1]==0x9C)
    header = list(b[:zlib_pos])
    try:
        dec = list(zlib.decompress(b[zlib_pos:]))
    except Exception as e:
        dec = []
    all_data[name] = {'header': header, 'dec': dec, 'raw': list(b)}

print('=== HEADER LENGTHS ===')
for name, d in all_data.items():
    print(f'{name}: header={len(d["header"])} bytes, decomp={len(d["dec"])} bytes')

print()
print('=== HEADERS SIDE BY SIDE (decimal) ===')
max_h = max(len(d['header']) for d in all_data.values())
print(f'{"idx":>3}  ' + '  '.join(f'{k:>12}' for k in all_data.keys()))
for i in range(max_h):
    row = []
    vals = []
    for name, d in all_data.items():
        v = d['header'][i] if i < len(d['header']) else '---'
        row.append(f'{v:>12}')
        if isinstance(v, int):
            vals.append(v)
    const = len(set(vals)) == 1 if len(vals) == 5 else False
    marker = ' === SAME ===' if const else ''
    print(f'{i:>3}: ' + '  '.join(row) + marker)

print()
print('=== DECOMPRESSED SIDE BY SIDE ===')
max_d = max(len(d['dec']) for d in all_data.values())
print(f'{"idx":>3}  ' + '  '.join(f'{k:>12}' for k in all_data.keys()))
for i in range(min(max_d, 60)):
    row = []
    vals = []
    for name, d in all_data.items():
        v = d['dec'][i] if i < len(d['dec']) else '---'
        row.append(f'{v:>12}')
        if isinstance(v, int):
            vals.append(v)
    const = len(set(vals)) == 1 if len(vals) == 5 else False
    marker = ' === SAME ===' if const else ''
    print(f'{i:>3}: ' + '  '.join(row) + marker)
