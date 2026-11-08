import base64
import os

with open('extracted_image1.png', 'rb') as f:
    b64 = base64.b64encode(f.read()).decode('utf-8')

os.makedirs('src/assets', exist_ok=True)
with open('src/assets/namabankLogoBase64.js', 'w', encoding='utf-8') as out:
    out.write('// Nam A Bank Official Logo (PNG 358x88 px, 5192 bytes)\n')
    out.write(f'export const NAM_A_BANK_LOGO_BASE64 = "{b64}";\n')

print(f'Successfully wrote src/assets/namabankLogoBase64.js (length: {len(b64)})')
