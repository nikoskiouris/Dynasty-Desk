#!/usr/bin/env python3
from pathlib import Path

path = Path(__file__).resolve().parent / "update_sleeper_trade_market.py"
text = path.read_text(encoding="utf-8")
old = '''        if early_id and mid_id and out[early_id] < out[mid_id]:
            out[early_id] = out[mid_id]
        if mid_id and late_id and out[mid_id] < out[late_id]:
            out[mid_id] = out[late_id]
'''
new = '''        # Normalize from the bottom up so raising mid cannot leave early below it.
        if mid_id and late_id and out[mid_id] < out[late_id]:
            out[mid_id] = out[late_id]
        if early_id and mid_id and out[early_id] < out[mid_id]:
            out[early_id] = out[mid_id]
'''
if text.count(old) != 1:
    raise RuntimeError(f"Expected one pick bucket block, found {text.count(old)}")
path.write_text(text.replace(old, new, 1), encoding="utf-8")
