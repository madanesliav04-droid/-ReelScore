#!/usr/bin/env python3
"""Gate commun à tous les presets Edit+ : exige transcription réelle horodatée.
À appeler APRÈS le montage et AVANT l'autorisation de publication.
Sans preuve audio->texte : status BLOCKED. Ne fournit pas de moteur ASR.
"""
import json, re, sys, unicodedata
from difflib import SequenceMatcher

def tokens(text):
    normalized = unicodedata.normalize("NFKD", text or "").lower()
    normalized = "".join(c for c in normalized if not unicodedata.combining(c))
    return re.findall(r"[a-z0-9]+", normalized.replace("’", "'"))

def interval_overlap(a, b):
    return max(0, min(a["end"], b["end"]) - max(a["start"], b["start"]))

def collide(b1, b2):
    if not b1 or not b2: return False
    return min(b1[2], b2[2])-max(b1[0], b2[0]) > .015 and min(b1[3], b2[3])-max(b1[1], b2[1]) > .015

def audit(payload):
    # Aucune exception de modèle (Codie, Hormozi, Data, UGC, etc.).
    errors = []
    preset = payload.get("preset")
    if not preset: errors.append("PRESET_MISSING")
    transcript = payload.get("transcript") or {}
    if transcript.get("provenance") not in ("asr_verified", "human_verified"):
        errors.append("NO_VERIFIED_SPEECH_TRANSCRIPT")
    if not transcript.get("engine"): errors.append("MISSING_TRANSCRIPT_ENGINE")
    if not payload.get("media_sha256") or payload["media_sha256"] != transcript.get("media_sha256"):
        errors.append("TRANSCRIPT_MEDIA_HASH_MISMATCH")
    speech, captions = transcript.get("words") or [], payload.get("captions") or []
    if not speech: errors.append("NO_TIMESTAMPED_SPOKEN_WORDS")
    if not captions: errors.append("NO_CAPTION_EVENTS")
    if not speech or not captions:
        return {"preset": preset, "release_approved": False, "status": "BLOCKED", "errors": errors}
    all_spoken = []
    for j,w in enumerate(speech):
        try:
            assert 0 <= float(w["start"]) < float(w["end"])
            assert tokens(w["text"])
            if float(w.get("confidence",1)) < .82: errors.append(f"LOW_ASR_CONFIDENCE:{j}")
            all_spoken += tokens(w["text"])
        except (AssertionError, ValueError, KeyError, TypeError):
            errors.append(f"INVALID_SPEECH_WORD:{j}")
    shown = []
    covered = set()
    for i,cap in enumerate(captions):
        try:
            assert 0 <= cap["start"] < cap["end"]
            ct = tokens(cap["text"])
            assert ct
        except (AssertionError, ValueError, KeyError, TypeError):
            errors.append(f"CAPTION_INVALID:{i}"); continue
        shown += ct
        near = []
        for j,w in enumerate(speech):
            try:
                if w["end"] >= cap["start"]-.12 and w["start"] <= cap["end"]+.12:
                    near += tokens(w["text"])
                    if interval_overlap(cap,w) >= min(.10,(w["end"]-w["start"])*.32):
                        covered.add(j)
            except (TypeError,KeyError): pass
        score = SequenceMatcher(a=ct,b=near,autojunk=False).ratio() if near else 0
        if score < .93: errors.append(f"CAPTION_NOT_VERBATIM:{i}:{score:.2f}")
        if len(ct) / max(.05,cap["end"]-cap["start"]) > 23: errors.append(f"CAPTION_TOO_FAST:{i}")
        if i and cap["start"] < captions[i-1].get("end",0)-.045:
            errors.append(f"CAPTIONS_OVERLAP:{i-1}:{i}")
        for j,v in enumerate(payload.get("visual_overlays") or []):
            if interval_overlap(cap,v)>.05 and collide(cap.get("bbox"),v.get("bbox")):
                errors.append(f"CAPTION_OVERLAPS_VISUAL:{i}:{j}")
    coverage = len(covered)/len(speech)
    overall = SequenceMatcher(a=shown,b=all_spoken,autojunk=False).ratio() if all_spoken else 0
    if coverage < .98: errors.append(f"UNCAPTIONED_SPEECH:{coverage:.3f}")
    if overall < .96: errors.append(f"GLOBAL_WORD_MISMATCH:{overall:.3f}")
    return {
        "preset":preset,
        "release_approved":not errors,
        "status":"APPROVED" if not errors else "BLOCKED",
        "errors":sorted(set(errors)),
        "metrics":{"spoken_word_coverage":round(coverage,4),"word_similarity":round(overall,4)}
    }

if __name__ == "__main__":
    with open(sys.argv[1],encoding="utf-8") as f: proof=json.load(f)
    result=audit(proof)
    print(json.dumps(result,ensure_ascii=False,indent=2))
    sys.exit(0 if result["release_approved"] else 2)
