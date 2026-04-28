
payload = '1C8104615000AA07477503554F7660900000CB393662789C013300CCFF00004B026AE5500CA926DAA5A682AA151191A2EB69969A28C68C14B4C3049C5981B15A65C89A48D450309899089E418780C5D03956179700EE61BC9724E64A'
b = bytes.fromhex(payload)

bits = ''
for byte in b:
    bits += format(byte, '08b')

targets = {60, 58, 54, 51}
required = 3

print('Searching for clusters of 3+ vote values (60,58,54,51) in any bit window...')
found = set()
for width in range(8, 16):
    for start in range(0, 200):
        vals = []
        for i in range(40):
            offset = start + i * width
            if offset + width > len(bits):
                break
            v = int(bits[offset:offset+width], 2)
            vals.append(v)
        matches = [v for v in vals if v in targets]
        if len(matches) >= required:
            key = (width, start)
            if key not in found:
                found.add(key)
                print(f'  width={width:2d} start={start:3d}: {vals[:20]}')
                print(f'     -> Matches: {matches}')
