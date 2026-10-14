"""Demo seed: staff directory, rules, and a LABELLED synthetic dataset (fictional Coimbatore pilot).
Live state is built through the real workflow so the audit hash chain is genuine.
Run: python seed.py  (deletes and recreates the DB)"""
import math
import os
import random
from datetime import timedelta

import db
import engine
import workflow

# Fictional staff directory (demo numbers). README references this list.
STAFF = [  # name, designation, mobile, role, dept_id, active
    ("R. Kavitha", "Triage Officer, Grievance Cell", "+919000000001", "triage", None, 1),
    ("S. Muthukumar", "Assistant Engineer, Roads", "+919000000002", "officer", "roads", 1),
    ("P. Lakshmi Priya", "Sanitary Inspector, Solid Waste Management", "+919000000003", "officer", "waste", 1),
    ("K. Senthil Kumar", "Junior Engineer, Electrical (Streetlights)", "+919000000004", "officer", "electrical", 1),
    ("M. Anitha", "Assistant Engineer, Drainage", "+919000000005", "officer", "drainage", 1),
    ("V. Ramesh Babu", "Assistant Engineer, Water Supply", "+919000000006", "officer", "water", 1),
    ("N. Saravanan", "Zonal Assistant Commissioner (Supervisor)", "+919000000007", "supervisor", None, 1),
    ("A. Meenakshi", "System Administrator, IT Cell", "+919000000008", "admin", None, 1),
    ("T. Ganesan", "Assistant Engineer, Roads (transferred out)", "+919000000009", "officer", "roads", 0),
]

R, G, S, D, W = "roads", "garbage", "streetlight", "drainage", "water"
EVIDENCE = {
    R: "Pothole patched with hot-mix; after-photo attached by AE",
    G: "Spot cleared and bin emptied; after-photo by Sanitary Inspector",
    S: "Faulty fitting replaced; lamps tested after dusk",
    D: "Drain desilted and flow restored; after-photo attached",
    W: "Damaged joint replaced; supply and pressure checked",
}


def K(ward, cat, dx, dy, plan, start_h, landmark, reports, handover=None):
    """One real-world issue. dx/dy: metres from the ward centroid. start_h: hours ago of first report.
    reports: (text, category|None, hours after first[, 'unlinked'])."""
    return dict(ward=ward, cat=cat, dx=dx, dy=dy, plan=plan, start_h=start_h, landmark=landmark,
                reports=reports, handover=handover)


CLUSTERS = [
    # --- Ward 1 Gandhipuram ---
    K(1, G, 0, 0, "assigned", 2, "Gandhipuram bus stand", [  # DEMO SCENARIO
        ("காந்திபுரம் பேருந்து நிலையம் அருகே குப்பைத் தொட்டி நிரம்பி வழிகிறது, நாற்றம் தாங்க முடியவில்லை", G, 0)]),
    K(1, R, 250, -350, "inprog", 60, "Cross Cut Road, near Sri Annapoorna", [
        ("Huge pothole on Cross Cut Road near Sri Annapoorna, two wheelers are falling at night", R, 0),
        ("கிராஸ் கட் ரோடு அன்னபூர்ணா அருகே பெரிய பள்ளம், இரவில் வண்டிகள் விழுகின்றன", None, 5),
        ("Cross cut road pallam romba periya, bike la pona risk, please fix", R, 26)]),
    K(1, R, 0, -120, "resolved", 110, "100 Feet Road petrol bunk", [
        ("Deep pothole in front of the 100 Feet Road petrol bunk, filled with rain water so cannot see it", R, 0),
        ("100 அடி சாலை பெட்ரோல் பங்க் முன் பெரிய குழி, மழைநீர் தேங்கி தெரியவில்லை", R, 30)]),
    K(1, S, -500, 300, "closed_s", 180, "Nehru Street", [
        ("Streetlights not working on Nehru Street for one week, very dark and unsafe for women", S, 0),
        ("நேரு வீதியில் தெருவிளக்குகள் ஒரு வாரமாக எரியவில்லை, பெண்கள் நடக்க பயப்படுகிறார்கள்", None, 20),
        ("Nehru street la light illa, full dark ah iruku", None, 44),
        ("நேரு வீதி முழுவதும் இருட்டு, திருடர்கள் பயம் அதிகம்", S, 50)]),
    K(1, G, -600, -100, "closed_v", 150, "5th Street, Gandhipuram", [
        ("Garbage not collected for 4 days in 5th Street Gandhipuram, dogs spreading it on the road", G, 0),
        ("காந்திபுரம் 5வது வீதியில் 4 நாட்களாக குப்பை எடுக்கவில்லை, நாய்கள் சாலையில் இழுத்து போடுகின்றன", None, 10)]),
    K(1, W, 300, 400, "ack", 20, "Ram Nagar", [
        ("Water tanker has not come to Ram Nagar, Gandhipuram for 2 days", W, 0),
        ("ராம் நகரில் இரண்டு நாட்களாக லாரி தண்ணீர் வரவில்லை", None, 12)]),
    # --- Ward 2 RS Puram ---
    K(2, W, 0, 0, "closed_v", 200, "DB Road post office", [
        ("Drinking water pipe burst on DB Road near the post office, water wasting since morning", W, 0),
        ("டி.பி. ரோடு தபால் நிலையம் அருகே குடிநீர் குழாய் உடைந்து தண்ணீர் வீணாகிறது", W, 3),
        ("DB road post office kitta pipe leak, lot of water waste", None, 8)]),
    K(2, W, 300, 150, "reopened", 170, "Ponnurangam Road", [
        ("No water supply in Ponnurangam Road for 3 days, we are buying cans", W, 0),
        ("பொன்னுரங்கம் சாலையில் மூன்று நாட்களாக குடிநீர் வரவில்லை", None, 12)]),
    K(2, D, 20, -30, "ack", 70, "RS Puram post office", [
        ("Sewage overflowing from manhole near RS Puram post office, very bad smell", D, 0),
        ("ஆர்.எஸ். புரம் தபால் நிலையம் அருகே சாக்கடை நிரம்பி கழிவுநீர் சாலையில் ஓடுகிறது", None, 30)]),
    K(2, S, -400, 200, "assigned", 90, "Thadagam Road, opp. Kovai Medical", [
        ("Street light pole damaged and hanging on Thadagam Road, dangerous for people walking", S, 0)]),
    K(2, R, -150, -300, "closed_s", 220, "West Periyasamy Road", [
        ("West Periyasamy Road is fully damaged after pipeline work, tar removed", R, 0),
        ("மேற்கு பெரியசாமி சாலை குழாய் வேலைக்குப் பிறகு முழுவதும் சேதமடைந்துள்ளது", None, 24)]),
    K(2, G, 100, -200, "closed_v", 150, "RS Puram flower market", [
        ("Garbage bin near RS Puram flower market overflowing every morning", G, 0),
        ("ஆர்.எஸ். புரம் பூ மார்க்கெட் அருகே தினமும் குப்பைத் தொட்டி நிரம்பி வழிகிறது", G, 10),
        ("Flower market waste rotting near RS Puram, smell is very bad", None, 30)]),
    # --- Ward 3 Peelamedu ---
    K(3, G, 0, 0, "closed_s", 160, "opp. PSG Tech main gate", [
        ("Garbage dumped on the footpath opp. PSG Tech main gate, students walking on road", G, 0),
        ("பி.எஸ்.ஜி டெக் எதிரே நடைபாதையில் குப்பை கொட்டப்பட்டுள்ளது", G, 6),
        ("Opp PSG Tech full ah kuppai, smell is unbearable", None, 20),
        ("Waste heap near PSG College bus stop not cleared", None, 40),
        ("PSG Tech opposite kuppai innum irukku, clean pannunga", None, 52)]),
    K(3, G, 350, 120, "resolved", 100, "Hope College signal", [
        ("Dustbin at Hope College signal is broken and trash is all over the road", G, 0),
        ("ஹோப் காலேஜ் சிக்னல் அருகே குப்பைத் தொட்டி உடைந்து குப்பை சிதறி கிடக்கிறது", None, 15)]),
    K(3, S, -300, 250, "inprog", 45, "Peelamedu Pudur main road", [
        ("Peelamedu Pudur main road streetlights off for 5 days", S, 0),
        ("பீளமேடு புதூர் பிரதான சாலையில் 5 நாட்களாக விளக்குகள் எரியவில்லை", S, 18),
        ("Peelamedu pudur light problem, road dark", None, 30)]),
    K(3, R, 100, -250, "ack", 40, "near Fun Republic mall", [
        ("Unmarked speed breaker near Fun Republic mall causing accidents, no white paint", R, 0)]),
    K(3, W, -150, -200, "closed_v", 230, "Nava India", [
        ("Tap water is coming muddy and smelly in Nava India area, children getting sick", W, 0),
        ("நவ இந்தியா பகுதியில் குழாய் தண்ணீர் கலங்கலாகவும் நாற்றமாகவும் வருகிறது", None, 4),
        ("Nava India la thanni colour maari varudhu, drinking water contaminated", W, 30)]),
    K(3, D, 200, 300, "closed_s", 175, "Kumudham Nagar", [
        ("Sewage water entering houses in Peelamedu Kumudham Nagar after rain", D, 0),
        ("குமுதம் நகரில் மழைக்குப் பின் சாக்கடை நீர் வீடுகளுக்குள் புகுகிறது", D, 6)]),
    # --- Ward 4 Saibaba Colony ---
    K(4, D, 0, 0, "reopened", 190, "NSR Road", [
        ("Drainage blocked on NSR Road, black water stagnant for a week, mosquito menace", D, 0),
        ("என்.எஸ்.ஆர் சாலையில் வடிகால் அடைப்பு, ஒரு வாரமாக கழிவுநீர் தேங்கி நிற்கிறது", None, 10),
        ("NSR road drainage still blocked, mosquitoes everywhere", None, 40),
        ("என்.எஸ்.ஆர் சாலை சாக்கடை இன்னும் சரி செய்யவில்லை", D, 46)]),
    K(4, D, 250, 200, "inprog", 40, "Bharathi Park Road 2nd cross", [
        ("Manhole cover missing on Bharathi Park Road 2nd cross, very risky at night", D, 0),
        ("பாரதி பார்க் சாலை 2வது குறுக்கு தெருவில் பாதாள சாக்கடை மூடி இல்லை", D, 9)]),
    K(4, G, 30, 20, "closed_s", 150, "NSR Road", [
        ("Garbage piled near the NSR Road drain, blocking the flow", None, 0),
        ("என்.எஸ்.ஆர் சாலை வடிகால் அருகே குப்பை குவிந்து கிடக்கிறது", G, 26)]),
    K(4, S, -350, -200, "closed_v", 210, "KK Pudur bus stop", [
        ("KK Pudur bus stop streetlight is blinking and off most nights", S, 0),
        ("கே.கே. புதூர் பஸ் ஸ்டாப் தெருவிளக்கு அடிக்கடி அணைந்து விடுகிறது", S, 20)]),
    K(4, W, -100, 350, "ack", 100, "Saibaba Colony market", [
        ("Water leaking from the road near Saibaba Colony market for two days", None, 0),
        ("சாய்பாபா காலனி மார்க்கெட் அருகே சாலையில் இருந்து தண்ணீர் கசிகிறது", None, 7)], handover="drainage"),
    K(4, R, -250, -300, "closed_s", 200, "Saibaba Colony flyover service lane", [
        ("Mettupalayam Road service lane potholes near Saibaba Colony flyover", R, 0),
        ("சாய்பாபா காலனி மேம்பாலம் அருகே சர்வீஸ் சாலையில் பள்ளங்கள்", None, 14)]),
    # --- Ward 5 Town Hall ---
    K(5, G, 0, 0, "closed_s", 140, "Big Bazaar Street", [
        ("Big Bazaar Street shops dumping waste on the road, garbage not lifted", G, 0),
        ("பெரிய கடை வீதியில் கடைக்காரர்கள் குப்பையை சாலையில் கொட்டுகிறார்கள்", G, 5),
        ("Big bazaar street la kuppai lorry varala, 3 days aachu", None, 30),
        ("Garbage heap at Big Bazaar Street junction still there, flies everywhere", None, 36)]),
    K(5, G, 200, -250, "closed_s", 130, "Oppanakara Street corner", [
        ("Overflowing garbage bin at Oppanakara Street corner near the jewellery shops", G, 0),
        ("ஒப்பணக்கார வீதி மூலையில் குப்பைத் தொட்டி நிரம்பி வழிகிறது", None, 20)]),
    K(5, R, -200, 150, "assigned", 30, "near Victoria Town Hall", [
        ("Road caved in near Town Hall Victoria Hall, big crater in the middle", R, 0),
        ("டவுன்ஹால் விக்டோரியா ஹால் அருகே சாலை உள்வாங்கி பெரிய குழி ஏற்பட்டுள்ளது", None, 4)]),
    K(5, W, 150, 300, "closed_v", 175, "Raja Street", [
        ("Water supply only for 10 minutes in Raja Street, very low pressure", W, 0),
        ("ராஜா வீதியில் 10 நிமிடம் மட்டுமே குடிநீர் வருகிறது, அழுத்தம் குறைவு", W, 22)]),
    K(5, D, -300, -200, "resolved", 120, "Rangai Gowder Street", [
        ("Rainwater and sewage flooding Rangai Gowder Street after every rain", None, 0),
        ("ரங்கை கவுடர் வீதியில் மழை பெய்தால் சாக்கடை நீர் தெருவில் ஓடுகிறது", None, 16)], handover="roads"),
    # --- Ward 6 Ukkadam ---
    K(6, R, 0, 0, "closed_s", 200, "Ukkadam bus stand entrance", [
        ("Ukkadam bus stand entrance road full of potholes, buses struggling", R, 0),
        ("உக்கடம் பேருந்து நிலைய நுழைவு சாலையில் பல பள்ளங்கள்", R, 3),
        ("Ukkadam bus stand road worst condition, many potholes", None, 36),
        ("உக்கடம் பஸ் ஸ்டாண்ட் ரோடு மிகவும் மோசமாக உள்ளது", None, 48)]),
    K(6, D, 300, -150, "assigned", 100, "Ukkadam lake bund", [
        ("Sewage flowing into Ukkadam lake from the open drain near the bund", D, 0),
        ("உக்கடம் குளக்கரை அருகே திறந்த சாக்கடை கழிவுநீர் குளத்தில் கலக்கிறது", D, 20)]),
    K(6, G, -250, 150, "closed_v", 160, "behind Ukkadam fish market", [
        ("Fish market waste dumped behind Ukkadam market, unbearable stink", G, 0),
        ("உக்கடம் மீன் மார்க்கெட் பின்புறம் மீன் கழிவுகள் கொட்டப்படுகின்றன, நாற்றம் தாங்க முடியவில்லை", None, 8),
        ("Fish waste smell near Ukkadam market, please clean", None, 14),
        ("மீன் மார்க்கெட் கழிவு, ஈக்கள் அதிகம், சுத்தம் செய்யவும்", G, 18)]),
    K(6, S, 100, 250, "ack", 30, "near Ukkadam police station", [
        ("Light near Ukkadam police station not working", None, 0)]),
    K(6, W, -100, -300, "assigned", 15, "Karumbukadai", [
        ("Contaminated drinking water in Ukkadam Karumbukadai, yellow colour", W, 0),
        ("கரும்புக்கடையில் குடிநீர் மஞ்சள் நிறத்தில் வருகிறது, குடிக்க முடியவில்லை", None, 6)]),
    # --- Ward 7 Singanallur ---
    K(7, W, 0, 0, "inprog", 50, "Singanallur bus terminus", [
        ("Pipeline leaking near Singanallur bus terminus, road getting damaged", W, 0),
        ("சிங்காநல்லூர் பேருந்து நிலையம் அருகே குடிநீர் குழாய் கசிவு", W, 6),
        ("Singanallur bus stand kitta pipe leak, thanni waste aagudhu", None, 20),
        ("Singanallur bus terminus water pipe broken, water flooding the road", None, 28)]),
    K(7, R, 40, 30, "assigned", 30, "Singanallur bus terminus", [
        ("Road surface broken near Singanallur bus terminus, big hole formed", R, 0)]),
    K(7, W, -300, 200, "closed_v", 140, "Kamarajar Road", [
        ("No drinking water in Kamarajar Road Singanallur since Monday", W, 0),
        ("சிங்காநல்லூர் காமராஜர் சாலையில் திங்கள் முதல் குடிநீர் வரவில்லை", None, 10)]),
    K(7, D, 250, -300, "reopened", 160, "Singanallur lake road", [
        ("Blocked drain near Singanallur lake road, water stagnant and smelling", D, 0),
        ("சிங்காநல்லூர் குளம் சாலையில் வடிகால் அடைத்து தண்ணீர் தேங்கியுள்ளது", D, 30)]),
    K(7, S, -200, -250, "closed_s", 190, "Trichy Road, Singanallur signal", [
        ("Five streetlights off on Trichy Road near Singanallur signal", S, 0),
        ("திருச்சி சாலை சிங்காநல்லூர் சிக்னல் அருகே ஐந்து தெருவிளக்குகள் எரியவில்லை", S, 12)]),
    # --- Ward 8 Ganapathy ---
    K(8, G, 0, 0, "inprog", 20, "Ganapathy mill compound", [
        ("Garbage burning near Ganapathy textile mill compound, smoke into houses", G, 0),
        ("கணபதி மில் அருகே குப்பையை எரிக்கிறார்கள், புகை வீடுகளுக்குள் வருகிறது", None, 3)]),
    K(8, S, 200, 250, "resolved", 90, "Ganapathy bus stop", [
        ("Streetlight near Ganapathy bus stop not working for 10 days", S, 0),
        ("கணபதி பஸ் ஸ்டாப் அருகே தெருவிளக்கு பத்து நாட்களாக எரியவில்லை", None, 2),
        ("Ganapathy bus stop light poyiduchu, too dark", None, 24)]),
    K(8, S, 0, 100, "ack", 36, "Maniyakaranpalayam Road", [
        ("Streetlight pole leaning dangerously on Maniyakaranpalayam Road, Ganapathy", S, 0)]),
    K(8, R, -300, -200, "closed_v", 215, "Ganapathy 3rd Street", [
        ("Road dug for UGD work and not closed in Ganapathy 3rd Street", R, 0),
        ("கணபதி 3வது வீதியில் பாதாள சாக்கடை வேலைக்காக தோண்டிய சாலை மூடப்படவில்லை", None, 40)]),
    # --- Ward 9 Vadavalli ---
    K(9, W, 0, 0, "closed_s", 185, "Vadavalli", [
        ("Siruvani water not received in Vadavalli for 4 days", W, 0),
        ("வடவள்ளியில் நான்கு நாட்களாக சிறுவாணி குடிநீர் வரவில்லை", W, 20)]),
    K(9, R, 250, 200, "inprog", 110, "Vadavalli junction, Maruthamalai Road", [
        ("Maruthamalai Road near Vadavalli junction badly damaged, many potholes", R, 0),
        ("மருதமலை சாலை வடவள்ளி சந்திப்பு அருகே சாலை மோசமாக சேதமடைந்துள்ளது", R, 8),
        ("Vadavalli junction road romba mosam, pallam everywhere", None, 50),
        ("மருதமலை ரோடு பள்ளங்களில் இரு சக்கர வாகனங்கள் விழுகின்றன", None, 70),
        ("Maruthamalai road pothole near Vadavalli still not fixed, bike skidded today", R, 107, "unlinked")]),
    K(9, G, -200, -150, "assigned", 20, "near Vadavalli temple", [
        ("Construction debris dumped on roadside near Vadavalli temple", None, 0)], handover="roads"),
    K(9, S, 300, -300, "unlinked", 5, None, [
        ("எங்கள் தெருவில் ஒரே இருட்டு, இரவில் நடக்க முடியவில்லை, உதவி செய்யவும்", None, 0)]),
    # --- Ward 10 Kuniyamuthur ---
    K(10, D, 0, 0, "closed_v", 170, "Palakkad Road, Kuniyamuthur", [
        ("Open drain overflowing on Palakkad Road Kuniyamuthur, sewage on road", D, 0),
        ("குனியமுத்தூர் பாலக்காடு சாலையில் சாக்கடை நிரம்பி சாலையில் ஓடுகிறது", None, 14),
        ("Kuniyamuthur Palakkad road drainage overflow, cannot walk", None, 20)]),
    K(10, D, 200, 250, "ack", 30, "Kuniyamuthur government school", [
        ("Drain clogged with plastic near Kuniyamuthur government school", D, 0)]),
    K(10, W, -250, 100, "resolved", 80, "Kuniyamuthur bus stop", [
        ("Water pipe broken near Kuniyamuthur bus stop, no supply to our street", None, 0),
        ("குனியமுத்தூர் பஸ் நிறுத்தம் அருகே குழாய் உடைந்து எங்கள் தெருவுக்கு தண்ணீர் இல்லை", W, 5)]),
    K(10, S, 100, -300, "closed_s", 150, "Sugunapuram", [
        ("Streetlights not working near Kuniyamuthur Sugunapuram, area dark after 7pm", S, 0),
        ("சுகுணாபுரம் பகுதியில் இரவு 7 மணிக்கு மேல் இருட்டாக உள்ளது, விளக்குகள் எரியவில்லை", None, 25)]),
    K(10, D, -50, -50, "unlinked", 4, None, [  # vague → low confidence / needs review
        ("Problem near my house, nobody is coming, please help", None, 0)]),
    K(3, W, -100, 400, "unlinked", 1, "Peelamedu park", [
        ("Water leaking from overhead tank valve near Peelamedu park", None, 0)]),
]


def _offset(lat, lng, dx, dy):
    return lat + dy / 111320, lng + dx / (111320 * math.cos(math.radians(lat)))


def reset_and_seed():
    if os.path.exists(db.DB_PATH):
        os.remove(db.DB_PATH)  # events are append-only, so a reset means a fresh file
    con = db.connect()
    db.init(con)
    run(con)
    con.commit()
    return con


def run(con):
    rng = random.Random(2026)
    now = db.now()
    con.executemany("INSERT INTO departments VALUES (?,?,?)", [(k, *v) for k, v in engine.DEPARTMENTS.items()])
    con.executemany("INSERT INTO wards VALUES (?,?,?,?)", engine.WARDS)
    con.executemany("INSERT INTO rules (category, ward_id, dept_id, keywords, ack_hours, resolve_hours, version) "
                    "VALUES (?,NULL,?,?,?,?,?)",
                    [(c, *v, engine.RULE_VERSION) for c, v in engine.RULES.items()])
    con.executemany("INSERT INTO staff (name, designation, mobile, role, dept_id, active) VALUES (?,?,?,?,?,?)", STAFF)
    staff = {(s["role"], s["dept_id"]): s for s in con.execute("SELECT * FROM staff WHERE active=1")}
    triage, sup = staff[("triage", None)], staff[("supervisor", None)]
    wards = {w[0]: w for w in engine.WARDS}

    # 1. materialise reports with absolute times; ids in time order
    reports = []
    for ci, cl in enumerate(CLUSTERS):
        w = wards[cl["ward"]]
        clat, clng = _offset(w[2], w[3], cl["dx"], cl["dy"])
        cl["key"] = f"C{ci + 1:02d}"
        cl["split"] = "tune" if ci % 10 in (1, 4, 7) else "test"
        cl["t0"] = now - timedelta(hours=cl["start_h"])
        cl["rep"] = []
        for k, (text, cat, dh, *flag) in enumerate(cl["reports"]):
            lat, lng = (clat, clng) if k == 0 else _offset(clat, clng, *(rng.uniform(30, 110) * f for f in
                                                                           _unit(rng.uniform(0, 2 * math.pi))))
            at = cl["t0"] + timedelta(hours=dh)
            assert at < now, (cl["key"], text)
            r = dict(text=text, cat=cat, lat=lat, lng=lng, at=at, cl=cl,
                     linked=cl["plan"] != "unlinked" and not flag)
            cl["rep"].append(r)
            reports.append(r)
    reports.sort(key=lambda r: r["at"])
    for i, r in enumerate(reports):
        r["id"] = f"CV-{i + 1:04d}"
    issues = sorted((c for c in CLUSTERS if c["plan"] != "unlinked"), key=lambda c: c["t0"])
    for i, cl in enumerate(issues):
        cl["iid"] = f"IS-{i + 1:04d}"

    con.executemany("INSERT INTO labels VALUES (?,?,?,?)",
                    [(r["id"], engine.RULES[r["cl"]["cat"]][0], r["cl"]["key"], r["cl"]["split"]) for r in reports])

    # 2. collect all actions, then apply in time order (the hash chain orders by insertion)
    actions = []
    add = lambda t, fn: actions.append((t, len(actions), fn))
    for r in reports:
        add(r["at"], lambda r=r: _submit(con, r))
    for cl in issues:
        _plan_issue(con, cl, rng, now, staff, triage, sup, add)
    t = min(r["at"] for r in reports)
    while t < now:  # periodic SLA sweep, as the running server would do
        add(t, lambda t=t: workflow.escalate_overdue(con, at=t))
        t += timedelta(hours=6)
    for _, _, fn in sorted(actions, key=lambda a: (a[0], a[1])):
        fn()
    workflow.escalate_overdue(con)


def _unit(a):
    return math.cos(a), math.sin(a)


def _submit(con, r):
    ward = engine.ward_for(r["lat"], r["lng"])
    con.execute("INSERT INTO reports (id, text, category, lat, lng, ward_id, landmark, created_at) VALUES (?,?,?,?,?,?,?,?)",
                (r["id"], r["text"], r["cat"], r["lat"], r["lng"], ward[0], r["cl"]["landmark"], db.iso(r["at"])))
    db.add_event(con, report_id=r["id"], kind="submitted", to_status="Triage", actor=f"Citizen ({r['id']})",
                 role="resident", reason="Report submitted", at=r["at"])


def _issue(con, iid):
    return con.execute("SELECT * FROM issues WHERE id=?", (iid,)).fetchone()


def _plan_issue(con, cl, rng, now, staff, triage, sup, add):
    cat, iid = cl["cat"], cl["iid"]
    dept = engine.RULES[cat][0]
    first, rest = cl["rep"][0], [r for r in cl["rep"][1:] if r["linked"]]
    T = first["at"] + timedelta(hours=0.5)
    _, _, ack_h, res_h = engine.RULES[cat]

    def create():
        start_dept = cl["handover"] or dept
        ack_due, res_due, why = workflow.sla_for(cat, T)
        w = engine.ward_for(first["lat"], first["lng"])
        con.execute("INSERT INTO issues (id, category, lat, lng, ward_id, dept_id, status, created_at, ack_due, "
                    "resolve_due, rule_version, sla_reason) VALUES (?,?,?,?,?,?,'Assigned',?,?,?,?,?)",
                    (iid, cat, first["lat"], first["lng"], w[0], start_dept, db.iso(T), ack_due, res_due,
                     engine.RULE_VERSION, why))
        _link(con, first, iid, triage, T, "New issue created from this report")
        db.add_event(con, issue_id=iid, report_id=first["id"], kind="created", from_status="Triage",
                     to_status="Assigned", actor=triage["name"], role="triage",
                     reason=f"Routed to {engine.DEPARTMENTS[start_dept][0]}", at=T)
        workflow.notify(con, iid, f"Your complaint is assigned to {engine.DEPARTMENTS[start_dept][0]}.", T)
    add(T, create)

    last_link = T
    for r in rest:
        lt = r["at"] + timedelta(hours=0.3)
        last_link = max(last_link, lt)
        cross = engine.is_tamil(r["text"]) != engine.is_tamil(first["text"])
        why = "Same issue — cross-language duplicate (Tamil ↔ English)" if cross else "Same issue — duplicate report nearby"
        add(lt, lambda r=r, lt=lt, why=why: _link(con, r, iid, triage, lt, why, extra=True))

    # step offsets (hours after T); some late on purpose
    steps = []
    off = 0.0
    if cl["handover"]:
        off = rng.uniform(1, 3)
        steps.append(("reject", off))
    plan = cl["plan"]
    if plan != "assigned":
        off = max(off + 0.5, ack_h * rng.uniform(0.3, 1.5))
        steps.append(("ack", off))
    if plan in ("inprog", "resolved", "reopened", "closed_s", "closed_v"):
        off += rng.uniform(1, 6)
        steps.append(("start", off))
    if plan == "inprog":
        steps.append(("update", off + rng.uniform(2, 8)))
    if plan in ("resolved", "reopened", "closed_s", "closed_v"):
        off = max(off + 1, res_h * rng.uniform(0.4, 1.6), (last_link - T).total_seconds() / 3600 + 1)
        steps.append(("resolve", off))
        if plan != "resolved":
            steps.append((plan, off + rng.uniform(4, 30)))
    avail = (now - T).total_seconds() / 3600 - 0.25
    if steps and steps[-1][1] > avail:  # squeeze the timeline into the time available
        k = avail / steps[-1][1]
        steps = [(s, o * k) for s, o in steps]
    officer = staff[("officer", dept)]
    for s, o in steps:
        at = T + timedelta(hours=o)
        if s == "resolve":
            assert at > last_link, (cl["key"], "resolve before last duplicate link")
        add(at, lambda s=s, at=at: _step(con, iid, s, at, cat, dept, cl, officer, staff, sup, rng))


def _link(con, r, iid, triage, at, why, extra=False):
    con.execute("INSERT INTO links (report_id, issue_id, linked_by, reason, created_at) VALUES (?,?,?,?,?)",
                (r["id"], iid, triage["name"], why, db.iso(at)))
    con.execute("UPDATE reports SET issue_id=? WHERE id=?", (iid, r["id"]))
    if extra:
        con.execute("UPDATE issues SET priority=priority+1 WHERE id=?", (iid,))
        db.add_event(con, issue_id=iid, report_id=r["id"], kind="linked", actor=triage["name"], role="triage",
                     reason=why, at=at)
        con.execute("INSERT INTO notifications (report_id, message, at) VALUES (?,?,?)",
                    (r["id"], f"Linked to existing issue {iid} — you will receive every update.", db.iso(at)))


def _step(con, iid, s, at, cat, dept, cl, officer, staff, sup, rng):
    iss = _issue(con, iid)
    if s == "reject":
        wrong = staff[("officer", cl["handover"])]
        workflow.transition(con, iss, wrong, "Rejected", reason="Not our department's work", new_dept_id=dept, at=at)
    elif s == "ack":
        workflow.transition(con, iss, officer, "Acknowledged", at=at)
    elif s == "start":
        workflow.transition(con, iss, officer, "In progress", public_note="Site inspected, work scheduled.", at=at)
    elif s == "update":
        workflow.transition(con, iss, officer, "In progress", public_note="Material arranged; crew on site tomorrow.", at=at)
    elif s == "resolve":
        reason = "Repaired" if cl["plan"] != "closed_s" else rng.choice(
            ["Repaired"] * 4 + ["No action needed", "Referred to other authority"])
        workflow.transition(con, iss, officer, "Resolved", closure_reason=reason, evidence=EVIDENCE[cat], at=at)
    elif s == "closed_s":
        workflow.transition(con, iss, sup, "Closed", reason="Closed by supervisor — no citizen confirmation", at=at)
    elif s == "closed_v":
        workflow.citizen_confirm(con, iss, cl["rep"][0]["id"], True, note="Checked today, it is fixed. Thank you.", at=at)
    elif s == "reopened":
        rid = [r for r in cl["rep"] if r["linked"]][-1]["id"]
        workflow.citizen_confirm(con, iss, rid, False, note="Not fixed — the problem is still there.", at=at)


def summary(con):
    st = {r[0]: r[1] for r in con.execute("SELECT status, COUNT(*) FROM issues GROUP BY status")}
    n = sum(st.values())
    now = db.iso(db.now())
    overdue = con.execute(f"SELECT COUNT(*) FROM issues WHERE status IN ({','.join('?' * len(workflow.OPEN))}) "
                          "AND resolve_due < ?", (*workflow.OPEN, now)).fetchone()[0]
    closed = st.get("Closed", 0)
    verified = con.execute("SELECT COUNT(*) FROM issues WHERE verified=1").fetchone()[0]
    return {
        "reports": con.execute("SELECT COUNT(*) FROM reports").fetchone()[0],
        "unlinked": con.execute("SELECT COUNT(*) FROM reports WHERE issue_id IS NULL").fetchone()[0],
        "issues": n, "by_status": st, "overdue_open": overdue,
        "escalated": con.execute("SELECT COUNT(*) FROM issues WHERE escalated=1").fetchone()[0],
        "bounces": con.execute("SELECT SUM(bounce_count) FROM issues").fetchone()[0],
        "closure_rate": round(closed / n, 2), "verified_rate": round(verified / n, 2),
        "events": con.execute("SELECT COUNT(*) FROM events").fetchone()[0],
        "chain": db.verify_chain(con),
    }


if __name__ == "__main__":
    c = reset_and_seed()
    for k, v in summary(c).items():
        print(f"{k}: {v}")
