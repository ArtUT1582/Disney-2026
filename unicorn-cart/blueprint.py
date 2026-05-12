"""Generate Unicorn_Cart_Blueprint.pdf - a 5-page cut/fold pattern.

Every page is gridded in inches. Dimensions are red with double-arrow
dimension lines. Cut lines are 2pt black. Fold lines are dashed blue.
Each page carries a small legend.

Run:  python3 blueprint.py
"""

from __future__ import annotations

import math

import matplotlib.pyplot as plt
from matplotlib.backends.backend_pdf import PdfPages
from matplotlib.patches import FancyArrowPatch, Polygon, Rectangle, Wedge

# -----------------------------------------------------------------------------
# Style constants
# -----------------------------------------------------------------------------
CUT_COLOR = "black"
CUT_LW = 2.0
FOLD_COLOR = "#1f77b4"
FOLD_LS = (0, (6, 4))
DIM_COLOR = "#d62728"
GRID_MAJOR = "#bbbbbb"
GRID_MINOR = "#eeeeee"

ROYGBIV = [
    ("Red",    "#e63946"),
    ("Orange", "#f3722c"),
    ("Yellow", "#f9c74f"),
    ("Green",  "#43aa8b"),
    ("Blue",   "#277da1"),
    ("Violet", "#7b2cbf"),
]


# -----------------------------------------------------------------------------
# Helpers
# -----------------------------------------------------------------------------
def setup_axes(ax, xlim, ylim, title):
    ax.set_xlim(*xlim)
    ax.set_ylim(*ylim)
    ax.set_aspect("equal")
    ax.set_title(title, fontsize=13, fontweight="bold", pad=10)

    # Inch grid (major every 1", minor every 0.5")
    x0, x1 = xlim
    y0, y1 = ylim
    ax.set_xticks(range(int(math.floor(x0)), int(math.ceil(x1)) + 1))
    ax.set_yticks(range(int(math.floor(y0)), int(math.ceil(y1)) + 1))
    ax.grid(True, which="major", color=GRID_MAJOR, linewidth=0.6)
    ax.minorticks_on()
    ax.grid(True, which="minor", color=GRID_MINOR, linewidth=0.3)
    ax.tick_params(labelsize=7)
    ax.set_xlabel("inches", fontsize=8)
    ax.set_ylabel("inches", fontsize=8)


def dim_line(ax, p1, p2, text, offset=0.0, orient="h", fontsize=9):
    """Draw a red double-arrow dimension line between p1 and p2."""
    x1, y1 = p1
    x2, y2 = p2
    if orient == "h":
        y = y1 + offset
        a = FancyArrowPatch((x1, y), (x2, y),
                            arrowstyle="<->", mutation_scale=12,
                            color=DIM_COLOR, lw=1.2)
        ax.add_patch(a)
        ax.plot([x1, x1], [y1, y], color=DIM_COLOR, lw=0.6)
        ax.plot([x2, x2], [y2, y], color=DIM_COLOR, lw=0.6)
        ax.text((x1 + x2) / 2, y + 0.15, text,
                ha="center", va="bottom",
                color=DIM_COLOR, fontsize=fontsize, fontweight="bold")
    else:
        x = x1 + offset
        a = FancyArrowPatch((x, y1), (x, y2),
                            arrowstyle="<->", mutation_scale=12,
                            color=DIM_COLOR, lw=1.2)
        ax.add_patch(a)
        ax.plot([x1, x], [y1, y1], color=DIM_COLOR, lw=0.6)
        ax.plot([x2, x], [y2, y2], color=DIM_COLOR, lw=0.6)
        ax.text(x + 0.15, (y1 + y2) / 2, text,
                ha="left", va="center",
                color=DIM_COLOR, fontsize=fontsize, fontweight="bold",
                rotation=90)


def add_legend(ax, loc=(0.02, 0.02)):
    """Small legend block in axes-fraction coords."""
    x, y = loc
    items = [
        ("Cut line",       CUT_COLOR, "-",  CUT_LW),
        ("Fold line",      FOLD_COLOR, "--", 1.4),
        ("Dimension",      DIM_COLOR, "-",  1.2),
    ]
    for i, (label, color, ls, lw) in enumerate(items):
        ax.plot([x, x + 0.05], [y + i * 0.03, y + i * 0.03],
                transform=ax.transAxes, color=color,
                linestyle=ls, linewidth=lw, clip_on=False)
        ax.text(x + 0.06, y + i * 0.03, label,
                transform=ax.transAxes, fontsize=7,
                va="center", clip_on=False)


# -----------------------------------------------------------------------------
# Page 1 - body box top view
# -----------------------------------------------------------------------------
def page1_top_view(pdf):
    fig, ax = plt.subplots(figsize=(11, 8.5))
    setup_axes(ax, (-3, 31), (-3, 21),
               "Page 1 of 5  -  Body Box, TOP VIEW  (28\" L x 18\" W)")

    # Outline (cut)
    ax.add_patch(Rectangle((0, 0), 28, 18, fill=False,
                           edgecolor=CUT_COLOR, lw=CUT_LW))

    # Torso opening 12 x 8, centered on width, 6" from FRONT edge.
    # Front of unicorn = +x direction; "6 from front" means inner edge of
    # opening is 6" behind the front edge (x = 28 - 6 = 22 inner front).
    opening_w, opening_h = 12.0, 8.0
    opening_x = 28 - 6 - opening_w   # = 10  (6" gap from front to opening)
    opening_y = (18 - opening_h) / 2  # = 5
    ax.add_patch(Rectangle((opening_x, opening_y), opening_w, opening_h,
                           fill=False, edgecolor=CUT_COLOR, lw=CUT_LW))
    ax.text(opening_x + opening_w / 2, opening_y + opening_h / 2,
            "TORSO OPENING\n12\" x 8\"  (cut out)",
            ha="center", va="center", fontsize=10, fontweight="bold")

    # Strap anchor points - 4 corners of opening, 1" inset diagonally
    anchors = [
        (opening_x - 1, opening_y - 1, "FL"),                       # front-left
        (opening_x + opening_w + 1, opening_y - 1, "FR"),           # front-right
        (opening_x - 1, opening_y + opening_h + 1, "RL"),           # rear-left
        (opening_x + opening_w + 1, opening_y + opening_h + 1, "RR"),
    ]
    for ax_x, ax_y, lbl in anchors:
        ax.plot(ax_x, ax_y, "o", color="black", markersize=10,
                markerfacecolor="white", markeredgewidth=2)
        ax.text(ax_x, ax_y, lbl, ha="center", va="center",
                fontsize=7, fontweight="bold")

    # Front-of-unicorn arrow
    ax.annotate("FRONT (head end)",
                xy=(28, 9), xytext=(30, 9),
                fontsize=9, fontweight="bold",
                ha="left", va="center",
                arrowprops=dict(arrowstyle="->", color="black", lw=1.4))

    # Dimensions
    dim_line(ax, (0, 0), (28, 0), '28"', offset=-1.4)
    dim_line(ax, (0, 0), (0, 18), '18"', offset=-1.4, orient="v")
    dim_line(ax, (opening_x, opening_y + opening_h),
             (opening_x + opening_w, opening_y + opening_h),
             '12"', offset=1.2)
    dim_line(ax, (opening_x + opening_w, opening_y),
             (opening_x + opening_w, opening_y + opening_h),
             '8"', offset=1.2, orient="v")
    dim_line(ax, (opening_x + opening_w, 18.6),
             (28, 18.6),
             '6" from front', offset=0.6)

    ax.text(14, 19.5,
            "Bottom of box is fully cut out - legs go through.",
            ha="center", fontsize=9, style="italic")
    ax.text(14, -2.4,
            "Anchor points (FL/FR/RL/RR) take 1\" webbing - punch holes "
            "and reinforce with washers underneath.",
            ha="center", fontsize=8)

    add_legend(ax)
    pdf.savefig(fig, bbox_inches="tight")
    plt.close(fig)


# -----------------------------------------------------------------------------
# Page 2 - body box side view with 6 rainbow stripes
# -----------------------------------------------------------------------------
def page2_side_view(pdf):
    fig, ax = plt.subplots(figsize=(11, 8.5))
    setup_axes(ax, (-3, 31), (-3, 26),
               "Page 2 of 5  -  Body Box, SIDE VIEW  (28\" L x 22\" H)")

    # Outline
    ax.add_patch(Rectangle((0, 0), 28, 22, fill=False,
                           edgecolor=CUT_COLOR, lw=CUT_LW))

    # 6 ROYGBIV stripes - red on top
    stripe_h = 22.0 / 6.0  # 3.666...
    for i, (name, color) in enumerate(ROYGBIV):
        y = 22 - (i + 1) * stripe_h
        ax.add_patch(Rectangle((0, y), 28, stripe_h,
                               facecolor=color, edgecolor="none", alpha=0.55))
        # Stripe label
        ax.text(14, y + stripe_h / 2,
                f"{name}  -  band {i+1}  -  3.67\" tall",
                ha="center", va="center", fontsize=10, fontweight="bold",
                color="black")
        # Stripe boundary (fold/score reference line, optional)
        if i < len(ROYGBIV) - 1:
            ax.plot([0, 28], [y, y], color=FOLD_COLOR,
                    linestyle=FOLD_LS, linewidth=1.0)

    # Front edge marker (head attaches here)
    ax.annotate("HEAD attaches\n(neck base flush\nwith this edge)",
                xy=(28, 18), xytext=(30, 20),
                fontsize=9, fontweight="bold", ha="left", va="center",
                arrowprops=dict(arrowstyle="->", color="black", lw=1.4))
    # Tail attachment
    ax.annotate("TAIL\nattaches",
                xy=(0, 11), xytext=(-2.6, 8),
                fontsize=9, fontweight="bold", ha="right", va="center",
                arrowprops=dict(arrowstyle="->", color="black", lw=1.4))

    # Dimensions
    dim_line(ax, (0, 0), (28, 0), '28" L', offset=-1.4)
    dim_line(ax, (28, 0), (28, 22), '22" H  =  6 x 3.67"',
             offset=1.4, orient="v")
    dim_line(ax, (0, 22 - stripe_h), (0, 22), '3.67"',
             offset=-1.4, orient="v", fontsize=8)

    ax.text(14, 23.5,
            "ROYGBIV stripes painted top-to-bottom on BOTH sides of the box.",
            ha="center", fontsize=9, style="italic")
    add_legend(ax)
    pdf.savefig(fig, bbox_inches="tight")
    plt.close(fig)


# -----------------------------------------------------------------------------
# Page 3 - head pattern (cut 2 mirrored)
# -----------------------------------------------------------------------------
def page3_head_pattern(pdf):
    fig, ax = plt.subplots(figsize=(11, 8.5))
    setup_axes(ax, (-3, 22), (-3, 23),
               "Page 3 of 5  -  Head Pattern  (CUT 2, MIRRORED)")

    # Side-profile unicorn head silhouette.
    # Coordinate frame:
    #   x = 0 ... 18 wide (8" muzzle reach + 10" widest -> total ~18)
    #   y = 0 ... 20 (14" head + 6" neck)
    # Define the outline as a polygon walking clockwise from the top of head:
    head = [
        (10.0, 20.0),   # top of head (back)
        (12.5, 19.0),   # ear root rear
        (13.4, 19.7),   # near-ear tip area (placement)
        (14.0, 18.0),   # forehead
        (16.0, 16.0),   # brow ridge
        (17.5, 13.5),   # nose bridge
        (18.0, 11.0),   # muzzle tip (8" muzzle reach from face plane at x=10)
        (17.2, 9.5),    # under nose
        (15.8, 8.8),    # mouth
        (14.5, 8.4),    # chin
        (13.0, 8.4),    # jaw
        (11.0, 9.4),    # throat
        (10.0, 10.5),   # throat-neck
        (9.4, 9.0),     # neck front
        (8.6, 6.5),     # neck mid-front
        (8.0, 3.0),     # neck mid
        (7.5, 0.0),     # neck base front (attaches to box top)
        (3.5, 0.0),     # neck base rear
        (4.0, 4.0),     # neck mid-rear
        (5.0, 9.0),     # neck rear curve
        (6.5, 13.0),    # back of neck into head
        (7.5, 16.0),    # back of head
        (8.5, 18.5),    # crown rear
        (10.0, 20.0),
    ]
    poly = Polygon(head, closed=True, fill=False,
                   edgecolor=CUT_COLOR, linewidth=CUT_LW)
    ax.add_patch(poly)
    # Light fill
    poly_fill = Polygon(head, closed=True, facecolor="#fafafa",
                        edgecolor="none", zorder=0)
    ax.add_patch(poly_fill)

    # Eye - almond
    eye_cx, eye_cy = 13.0, 15.3
    eye = Polygon([
        (eye_cx - 0.9, eye_cy),
        (eye_cx, eye_cy + 0.35),
        (eye_cx + 0.9, eye_cy),
        (eye_cx, eye_cy - 0.35),
    ], closed=True, facecolor="black", edgecolor="black")
    ax.add_patch(eye)
    ax.annotate("eye",
                xy=(eye_cx, eye_cy), xytext=(eye_cx - 4, eye_cy + 2),
                fontsize=8, arrowprops=dict(arrowstyle="->", lw=0.8))

    # Nostril
    nos_cx, nos_cy = 16.8, 10.6
    ax.add_patch(plt.Circle((nos_cx, nos_cy), 0.35,
                            facecolor="#ff9bb3", edgecolor="black", lw=0.6))
    ax.annotate("nostril",
                xy=(nos_cx, nos_cy), xytext=(nos_cx - 1.5, nos_cy - 2.5),
                fontsize=8, arrowprops=dict(arrowstyle="->", lw=0.8))

    # Ear position (cut separately, glue on at this mark)
    ear_x, ear_y = 11.5, 19.3
    ax.plot(ear_x, ear_y, "x", color=CUT_COLOR, markersize=10, mew=2)
    ax.annotate("EAR glue point\n(2.5\" tall, cut 2)",
                xy=(ear_x, ear_y), xytext=(ear_x - 5, ear_y + 1),
                fontsize=8, arrowprops=dict(arrowstyle="->", lw=0.8))

    # Horn attachment point
    horn_x, horn_y = 13.2, 19.4
    ax.plot(horn_x, horn_y, "*", color="goldenrod", markersize=14)
    ax.annotate("HORN base\n(2.5\" dia)",
                xy=(horn_x, horn_y), xytext=(horn_x + 2.5, horn_y + 1),
                fontsize=8, color="darkgoldenrod",
                arrowprops=dict(arrowstyle="->", lw=0.8,
                                color="darkgoldenrod"))

    # Neck fold line (where head folds against box top)
    ax.plot([3.5, 7.5], [0, 0], color=FOLD_COLOR,
            linestyle=FOLD_LS, linewidth=1.6)
    ax.text(5.5, -0.5, "fold here / glue tab to box top",
            ha="center", fontsize=7, color=FOLD_COLOR)

    # Dimensions
    dim_line(ax, (3.5, -1.5), (18, -1.5), '14.5" head + muzzle reach',
             offset=0, fontsize=8)
    dim_line(ax, (-1.2, 0), (-1.2, 20), '20" total\n(14" head + 6" neck)',
             offset=0, orient="v", fontsize=8)
    dim_line(ax, (18.6, 8.0), (18.6, 18.0), '10" widest',
             offset=0, orient="v", fontsize=8)
    dim_line(ax, (10.0, 21.0), (18.0, 21.0), '8" muzzle reach',
             offset=0, fontsize=8)

    ax.text(9, 22.2,
            "Cut TWO of these from chipboard, MIRRORED. "
            "Sandwich a 1\" foamcore spacer between them for a 1\" thick head.",
            ha="center", fontsize=8.5, style="italic")
    add_legend(ax)
    pdf.savefig(fig, bbox_inches="tight")
    plt.close(fig)


# -----------------------------------------------------------------------------
# Page 4 - horn template (top) + tail teardrop (bottom)
# -----------------------------------------------------------------------------
def page4_horn_and_tail(pdf):
    fig, (ax_top, ax_bot) = plt.subplots(2, 1, figsize=(8.5, 11))

    # --- HORN: quarter-circle template ---
    # Cone with slant length L = sqrt(8^2 + 1.25^2) ~= 8.097"
    # Base radius r = 1.25", base circumference = 2*pi*r ~= 7.854"
    # On flat template, arc radius = L, arc angle theta = (2*pi*r) / L
    # theta ~= 0.9700 rad ~= 55.58 degrees
    L = math.sqrt(8.0 ** 2 + 1.25 ** 2)
    r = 1.25
    theta_deg = math.degrees(2 * math.pi * r / L)

    setup_axes(ax_top, (-2, 11), (-2, 11),
               "Page 4a  -  HORN template (8\" cone, 2.5\" base dia)")

    # Wedge representing the unrolled cone face
    wedge = Wedge(center=(0, 0), r=L, theta1=0, theta2=theta_deg,
                  facecolor="#fff3b0", edgecolor=CUT_COLOR, linewidth=CUT_LW)
    ax_top.add_patch(wedge)

    # Spiral guide line on the wedge
    spiral_t = [i / 30 for i in range(31)]
    sx = [t * L * math.cos(math.radians(theta_deg * t * 1.5)) for t in spiral_t]
    sy = [t * L * math.sin(math.radians(theta_deg * t * 1.5)) for t in spiral_t]
    ax_top.plot(sx, sy, color="goldenrod", linewidth=1.0, linestyle=":")

    # Glue tab along one straight edge
    tab_w = 0.4
    tab = Polygon([(0, 0), (L, 0), (L, -tab_w), (0, -tab_w)],
                  facecolor="none", edgecolor=FOLD_COLOR,
                  linestyle=FOLD_LS, linewidth=1.2)
    ax_top.add_patch(tab)
    ax_top.text(L / 2, -0.7, "glue tab (fold under)",
                ha="center", fontsize=7, color=FOLD_COLOR)

    # Dimensions
    dim_line(ax_top, (0, 0), (L, 0),
             f'slant = {L:.2f}"', offset=-1.4, fontsize=8)
    ax_top.text(L * 0.55 * math.cos(math.radians(theta_deg * 0.55)) - 0.3,
                L * 0.55 * math.sin(math.radians(theta_deg * 0.55)) + 0.3,
                f"arc angle = {theta_deg:.1f} deg\n"
                f"(rolls to 2.5\" base dia)",
                fontsize=8, color=DIM_COLOR, fontweight="bold")
    ax_top.text(3.5, 9.5,
                "Cut from gold metallic cardstock. Roll into cone, glue tab "
                "behind seam, add spiral with iridescent glitter pen.",
                ha="center", fontsize=8, style="italic")

    add_legend(ax_top, loc=(0.02, 0.85))

    # --- TAIL: teardrop ---
    setup_axes(ax_bot, (-2, 13), (-2, 9),
               "Page 4b  -  TAIL base teardrop  (10\" L x 6\" W cardboard)")

    # Teardrop pointing left (point attaches to body box)
    teardrop = []
    n = 80
    for i in range(n + 1):
        t = i / n
        ang = t * 2 * math.pi
        # Egg/teardrop: thin point at left (x=0), bulb at right (x=10)
        x = 5 + 5 * math.cos(math.pi - ang)
        # Width function: pinched at left, full at right
        bulb = 3.0 * math.sin(ang) * (0.4 + 0.6 * (1 - math.cos(ang)) / 2)
        y = bulb
        teardrop.append((x, y))
    tear_poly = Polygon(teardrop, closed=True, facecolor="#f5e6d3",
                        edgecolor=CUT_COLOR, linewidth=CUT_LW)
    ax_bot.add_patch(tear_poly)

    # Yarn attachment ticks along the right (bulb) edge
    for ang_deg in range(-70, 71, 14):
        ang = math.radians(ang_deg)
        cx = 5 + 4.6 * math.cos(ang)
        cy = 2.6 * math.sin(ang)
        ax_bot.plot([cx, cx + 0.4 * math.cos(ang)],
                    [cy, cy + 0.4 * math.sin(ang)],
                    color="black", linewidth=0.8)
    ax_bot.text(8.5, 3.6, "punch yarn anchor\nholes along bulb edge",
                fontsize=7.5)

    # Attachment edge (fold/glue)
    ax_bot.plot([0, 0.4], [0, 0], color=FOLD_COLOR,
                linestyle=FOLD_LS, linewidth=1.6)
    ax_bot.text(0.2, -0.5, "glue to body box rear",
                ha="left", fontsize=7, color=FOLD_COLOR)

    dim_line(ax_bot, (0, -1.2), (10, -1.2), '10" L', offset=0, fontsize=8)
    dim_line(ax_bot, (10.6, -3), (10.6, 3), '6" W', offset=0,
             orient="v", fontsize=8)

    add_legend(ax_bot, loc=(0.02, 0.02))

    fig.suptitle("Page 4 of 5  -  Horn + Tail templates",
                 fontsize=13, fontweight="bold")
    fig.tight_layout(rect=[0, 0, 1, 0.96])
    pdf.savefig(fig, bbox_inches="tight")
    plt.close(fig)


# -----------------------------------------------------------------------------
# Page 5 - interior strap layout
# -----------------------------------------------------------------------------
def page5_strap_layout(pdf):
    fig, ax = plt.subplots(figsize=(11, 8.5))
    setup_axes(ax, (-3, 31), (-4, 22),
               "Page 5 of 5  -  Interior STRAP layout  (X-pattern + chest clip)")

    # Box top outline (we are looking down INTO the box from above)
    ax.add_patch(Rectangle((0, 0), 28, 18, fill=False,
                           edgecolor=CUT_COLOR, lw=CUT_LW))

    # Torso opening (where the kid stands)
    opening_w, opening_h = 12.0, 8.0
    opening_x = 28 - 6 - opening_w
    opening_y = (18 - opening_h) / 2
    ax.add_patch(Rectangle((opening_x, opening_y), opening_w, opening_h,
                           facecolor="#eef6ff", edgecolor=CUT_COLOR,
                           lw=CUT_LW, linestyle=(0, (1, 1))))
    ax.text(opening_x + opening_w / 2, opening_y + opening_h / 2,
            "torso opening\n(kid stands here)",
            ha="center", va="center", fontsize=9, style="italic")

    # Anchor points (same as page 1)
    fl = (opening_x - 1, opening_y - 1)
    fr = (opening_x + opening_w + 1, opening_y - 1)
    rl = (opening_x - 1, opening_y + opening_h + 1)
    rr = (opening_x + opening_w + 1, opening_y + opening_h + 1)
    for ax_x, ax_y, lbl in [(*fl, "FL"), (*fr, "FR"),
                            (*rl, "RL"), (*rr, "RR")]:
        ax.plot(ax_x, ax_y, "o", color="black", markersize=10,
                markerfacecolor="white", markeredgewidth=2)
        ax.text(ax_x, ax_y, lbl, ha="center", va="center",
                fontsize=7, fontweight="bold")

    # X-pattern webbing: strap A goes FL -> over kid's left shoulder -> RR;
    # strap B goes FR -> over right shoulder -> RL.  Drawn here as the
    # straight diagonals across the opening, with a chest clip at center.
    center = (opening_x + opening_w / 2, opening_y + opening_h / 2)
    ax.plot([fl[0], rr[0]], [fl[1], rr[1]],
            color="#444444", linewidth=4, solid_capstyle="round")
    ax.plot([fr[0], rl[0]], [fr[1], rl[1]],
            color="#444444", linewidth=4, solid_capstyle="round")

    # Chest clip
    ax.add_patch(Rectangle((center[0] - 0.9, center[1] - 0.45),
                           1.8, 0.9,
                           facecolor="#222", edgecolor="black"))
    ax.text(center[0], center[1] + 1.0, "1\" side-release CHEST CLIP",
            ha="center", fontsize=9, fontweight="bold")

    # Strap labels with lengths
    ax.text((fl[0] + rr[0]) / 2 - 3, (fl[1] + rr[1]) / 2 - 1.2,
            "Strap A  -  36\" webbing",
            color="#444", fontsize=9, fontweight="bold")
    ax.text((fr[0] + rl[0]) / 2 + 0.5, (fr[1] + rl[1]) / 2 + 0.5,
            "Strap B  -  36\" webbing",
            color="#444", fontsize=9, fontweight="bold")

    # Front-of-unicorn arrow
    ax.annotate("FRONT (head end)",
                xy=(28, 9), xytext=(30, 9),
                fontsize=9, fontweight="bold",
                ha="left", va="center",
                arrowprops=dict(arrowstyle="->", color="black", lw=1.4))

    # Dimensions
    dim_line(ax, fl, rr,
             "diagonal ~14.6\" inside; 36\" total includes shoulder rise",
             offset=-2.5, fontsize=8)

    # Notes block
    notes = (
        "ROUTING:\n"
        "  1. Punch 1/4\" holes at FL, FR, RL, RR.\n"
        "  2. Reinforce each hole with a fender washer + duct-tape patch INSIDE the box.\n"
        "  3. Strap A: anchor at FL, up over kid's LEFT shoulder, clip in front, "
        "down to RR.\n"
        "  4. Strap B: anchor at FR, up over kid's RIGHT shoulder, clip in front, "
        "down to RL.\n"
        "  5. Adjust slack so box hangs at kid's hip - bottom of box ~mid-thigh.\n"
        "  6. Chest clip must release in under 2 sec - TEST before paint day."
    )
    ax.text(14, -3.4, notes, ha="center", va="top",
            fontsize=8.5, family="monospace",
            bbox=dict(boxstyle="round,pad=0.4", facecolor="#fffbe6",
                      edgecolor="#cc9900"))

    add_legend(ax, loc=(0.02, 0.92))
    pdf.savefig(fig, bbox_inches="tight")
    plt.close(fig)


# -----------------------------------------------------------------------------
# Main
# -----------------------------------------------------------------------------
def main():
    out = "Unicorn_Cart_Blueprint.pdf"
    with PdfPages(out) as pdf:
        page1_top_view(pdf)
        page2_side_view(pdf)
        page3_head_pattern(pdf)
        page4_horn_and_tail(pdf)
        page5_strap_layout(pdf)
        d = pdf.infodict()
        d["Title"] = "Rainbow Unicorn Cardboard Cart - Blueprint"
        d["Author"] = "unicorn-cart"
        d["Subject"] = "5-page cut/fold pattern, dimensions in inches"
    print(f"Wrote {out}")


if __name__ == "__main__":
    main()
