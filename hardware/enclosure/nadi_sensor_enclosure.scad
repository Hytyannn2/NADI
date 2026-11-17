// NADI river sensor node enclosure, drawing NADI-HW-01 Rev A.
// Open in OpenSCAD, set `part`, press F6, then File > Export > STL.
// Units: mm. Origin: body front-left-bottom corner, +y toward the mounting socket (back).
// Print in ASA or PETG (not PLA), white. Walls 4+ perimeters, 25 % gyroid, 0.2 mm layers.

part = "assembly"; // [assembly, body, lid, gasket, insert_a, insert_b, ring, cap, spacer]

$fn = 64;
eps = 0.01;

// ---- box ----
L = 112;          // outer length (x)
W = 80;           // outer depth (y)
H = 62;           // body height incl. floor
wall = 3;
floor_t = 3;

// Lid fixing: M3 heat-set inserts (Ø4.2 × 6) in six bosses
lid_boss = [[6,6],[56,5.5],[106,6],[6,74],[56,74.5],[106,74]];
insert_d = 4.2;
insert_depth = 6;

// Electronics tray (96 × 64 perfboard) on four standoffs
tray_boss = [[12,14],[100,14],[12,66],[100,66]];
tray_h = 26;      // standoff height above the floor

// Sonar: floor window, swappable insert plate, open hood underneath
son = [56,31];    // centre of the sonar window
win = [60,30];
plate = [70,40,3];
plate_screws = [[24,14],[88,14],[24,48],[88,48]]; // M3 screw + nut, nut sits inside the hood
hood = [76,46,10];
hood_wall = 2;
hcsr04_can_d = 16.5;   // measure your HC-SR04: drawn 16 mm cans
hcsr04_pitch = 26;     // measure: centre-to-centre of the two cans

// Side openings (z measured from the body bottom)
pg7 = [40,20,12.5];    // right wall: y, z, Ø
vent = [40,50,12.2];   // left wall: M12 vent plug

// Rear socket for a 20 × 20 mm aluminium square tube, two M5 cross bolts
sock = [30,40,30];     // x, y (length), z
sock_z0 = 16;
bore = 20.6;
m5 = 5.3;

// Lid
lid_top = 4;
skirt = 4;
skirt_gap = 0.4;
skirt_wall = 3.6;
sma_hole = [96,60,6.5]; // over the Ra-02; u.FL-to-SMA bulkhead

// Air sensor radiation shield
ring_od = 64; ring_id = 34; ring_t = 2;
rod_r = 27; rod_d = 3.4;   // three M3 rods at 120°
spacer_h = 8;              // ring pitch = ring_t + spacer_h = 10
cap_t = 3;

module body() {
  difference() {
    union() {
      difference() {
        cube([L, W, H]);
        translate([wall, wall, floor_t]) cube([L - 2*wall, W - 2*wall, H]);
      }
      for (p = lid_boss) translate([p[0], p[1], 0]) cylinder(d = 8, h = H);
      for (p = tray_boss) translate([p[0], p[1], 0]) cylinder(d = 8, h = floor_t + tray_h);
      // open-bottom sonar hood under the floor
      translate([son[0] - hood[0]/2, son[1] - hood[1]/2, -hood[2]]) difference() {
        cube(hood + [0, 0, eps]);
        translate([hood_wall, hood_wall, -1]) cube([hood[0] - 2*hood_wall, hood[1] - 2*hood_wall, hood[2] + 2]);
      }
      // tube socket with a 45° gusset under it
      translate([son[0] - sock[0]/2, W - eps, sock_z0]) cube([sock[0], sock[1] + eps, sock[2]]);
      translate([son[0] - sock[0]/2, W - eps, 0]) rotate([90, 0, 90])
        linear_extrude(sock[0]) polygon([[0, 0], [0, sock_z0], [sock_z0, sock_z0]]);
    }
    translate([son[0] - win[0]/2, son[1] - win[1]/2, -1]) cube([win[0], win[1], floor_t + 2]);
    for (p = plate_screws) translate([p[0], p[1], -1]) cylinder(d = 3.4, h = floor_t + 2);
    for (p = lid_boss) translate([p[0], p[1], H - insert_depth]) cylinder(d = insert_d, h = insert_depth + 1);
    for (p = tray_boss) translate([p[0], p[1], floor_t + tray_h - insert_depth]) cylinder(d = insert_d, h = insert_depth + 1);
    translate([L - wall - 1, pg7[0], pg7[1]]) rotate([0, 90, 0]) cylinder(d = pg7[2], h = wall + 2);
    translate([-1, vent[0], vent[1]]) rotate([0, 90, 0]) cylinder(d = vent[2], h = wall + 2);
    // blind bore: the box wall stays closed
    translate([son[0] - bore/2, W, sock_z0 + (sock[2] - bore)/2]) cube([bore, sock[1] + 1, bore]);
    for (y = [W + 10, W + 30]) translate([son[0] - sock[0]/2 - 1, y, sock_z0 + sock[2]/2]) rotate([0, 90, 0]) cylinder(d = m5, h = sock[0] + 2);
  }
}

// Modelled as fitted on the body (skirt down); the print part is flipped onto its top face.
module lid() {
  o = skirt_gap + skirt_wall;
  difference() {
    translate([-o, -o, 0]) union() {
      translate([0, 0, skirt]) cube([L + 2*o, W + 2*o, lid_top]);
      difference() {
        cube([L + 2*o, W + 2*o, skirt + eps]);
        translate([skirt_wall, skirt_wall, -1]) cube([L + 2*skirt_gap, W + 2*skirt_gap, skirt + 2]);
      }
    }
    for (p = lid_boss) translate([p[0], p[1], -1]) {
      cylinder(d = 3.4, h = skirt + lid_top + 2);
      translate([0, 0, skirt + lid_top - 2 + 1]) cylinder(d = 6.5, h = 3); // counterbore for M3 heads
    }
    translate([sma_hole[0], sma_hole[1], -1]) cylinder(d = sma_hole[2], h = skirt + lid_top + 2);
  }
}

// Flat gasket for the body rim: print in TPU 95A, or use as a template for 2 mm EPDM sheet.
module gasket(t = 1.5) {
  difference() {
    union() {
      difference() { cube([L, W, t]); translate([wall, wall, -1]) cube([L - 2*wall, W - 2*wall, t + 2]); }
      for (p = lid_boss) translate([p[0], p[1], 0]) cylinder(d = 8, h = t);
    }
    for (p = lid_boss) translate([p[0], p[1], -1]) cylinder(d = 3.4, h = t + 2);
  }
}

// Insert A has the two HC-SR04 holes; insert B is blank, to drill for a JSN-SR04T or A02YYUW probe.
module insert(sonar_holes = true) {
  difference() {
    cube(plate);
    for (p = plate_screws) translate([p[0] - (son[0] - plate[0]/2), p[1] - (son[1] - plate[1]/2), -1]) cylinder(d = 3.4, h = plate[2] + 2);
    if (sonar_holes) for (dx = [-1, 1]) translate([plate[0]/2 + dx*hcsr04_pitch/2, plate[1]/2, -1]) cylinder(d = hcsr04_can_d, h = plate[2] + 2);
  }
}

module rod_holes(h) { for (a = [90, 210, 330]) rotate(a) translate([rod_r, 0, -1]) cylinder(d = rod_d, h = h + 2); }

// Print 5 rings, 1 cap and 15 spacers; stack on three M3 rods with nuts top and bottom.
module ring() { difference() { cylinder(d = ring_od, h = ring_t); translate([0, 0, -1]) cylinder(d = ring_id, h = ring_t + 2); rod_holes(ring_t); } }

module cap() {
  clip = [28, 30, 27];
  difference() {
    union() {
      cylinder(d = ring_od, h = cap_t);
      translate([-clip[0]/2, -clip[1]/2, cap_t - eps]) cube(clip + [0, 0, eps]);
    }
    rod_holes(cap_t);
    translate([-bore/2, -clip[1]/2 - 1, cap_t + (clip[2] - bore)/2]) cube([bore, clip[1] + 2, bore]);
    translate([0, 0, cap_t + clip[2] - 4]) cylinder(d = m5, h = 6); // M5 grub bolt onto the tube
  }
}

module spacer() { difference() { cylinder(d = 7, h = spacer_h); translate([0, 0, -1]) cylinder(d = rod_d, h = spacer_h + 2); } }

if (part == "body") body();
else if (part == "lid") translate([0, 0, skirt + lid_top]) rotate([180, 0, 0]) lid();
else if (part == "gasket") gasket();
else if (part == "insert_a") insert(true);
else if (part == "insert_b") insert(false);
else if (part == "ring") ring();
else if (part == "cap") cap();
else if (part == "spacer") spacer();
else {
  // assembly preview: lid lifted 20 mm, insert in place, shield beside the box
  color("white") body();
  color("gainsboro", 0.8) translate([0, 0, H + 20]) lid();
  color("silver") translate([son[0] - plate[0]/2, son[1] - plate[1]/2, floor_t]) insert(true);
  translate([L + 60, W/2, -hood[2]]) {
    for (i = [0:4]) color("white") translate([0, 0, i*(ring_t + spacer_h)]) ring();
    color("white") translate([0, 0, 5*(ring_t + spacer_h)]) cap();
  }
}
