#!/usr/bin/env python3
"""Draw the 12 preposition scenes as flat 200x200 SVGs.

Every scene is the same red ball and the same open orange box, so the only
thing that changes between pictures is where the ball is. That is the whole
lesson: the child compares two pictures and the only difference is the word.
"""
import os

OUT = os.path.expanduser("~/Desktop/kitai-words/assets/images")

BALL = "#ff4d5e"
BALL_HI = "#ffd7dc"
BOX_FRONT = "#ffb26b"
BOX_SIDE = "#e08b45"
BOX_IN = "#8a4a12"
LINE = "#5a3a1a"
GROUND = "#bcd8f5"
ARROW = "#2f6bd8"


def head(extra=""):
    return (
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="200" height="200">'
        '<rect width="200" height="200" rx="24" fill="#eef6ff"/>'
        f'<line x1="12" y1="166" x2="188" y2="166" stroke="{GROUND}" stroke-width="7" '
        'stroke-linecap="round"/>' + extra
    )


def ball(cx, cy, r=23, opacity=1.0):
    return (
        f'<g opacity="{opacity}">'
        f'<circle cx="{cx}" cy="{cy}" r="{r}" fill="{BALL}" stroke="{LINE}" stroke-width="3"/>'
        f'<circle cx="{cx - r * 0.32:.0f}" cy="{cy - r * 0.34:.0f}" r="{r * 0.26:.0f}" fill="{BALL_HI}"/>'
        "</g>"
    )


def box_back(x=62, y=96, w=80, h=54, d=16):
    """Everything of the box that sits behind the ball: the opening + back wall."""
    return (
        # opening (the dark inside), drawn as the top parallelogram
        f'<polygon points="{x},{y} {x+w},{y} {x+w+d},{y-d} {x+d},{y-d}" '
        f'fill="{BOX_IN}" stroke="{LINE}" stroke-width="3" stroke-linejoin="round"/>'
    )


def box_front(x=62, y=96, w=80, h=54, d=16):
    """Everything that sits in front of the ball: the front and right walls."""
    return (
        f'<polygon points="{x+w},{y} {x+w+d},{y-d} {x+w+d},{y+h-d} {x+w},{y+h}" '
        f'fill="{BOX_SIDE}" stroke="{LINE}" stroke-width="3" stroke-linejoin="round"/>'
        f'<rect x="{x}" y="{y}" width="{w}" height="{h}" fill="{BOX_FRONT}" '
        f'stroke="{LINE}" stroke-width="3"/>'
    )


def box(x=62, y=96, w=80, h=54, d=16):
    return box_back(x, y, w, h, d) + box_front(x, y, w, h, d)


def arrow(d, color=ARROW, dash=""):
    dash = f' stroke-dasharray="{dash}"' if dash else ""
    return (
        f'<path d="{d}" fill="none" stroke="{color}" stroke-width="7" stroke-linecap="round"'
        f'{dash} marker-end="url(#ah)"/>'
    )


DEFS = (
    '<defs><marker id="ah" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="5" '
    f'markerHeight="5" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="{ARROW}"/>'
    "</marker></defs>"
)

TAIL = "</svg>"


def scene(body):
    return head() + DEFS + body + TAIL


# --- the twelve pictures ----------------------------------------------------

SCENES = {
    # ball sitting down inside the box: opening, ball, then the front wall over it
    "in": box_back() + ball(110, 89) + box_front(),
    # ball resting on the closed top of the box
    "on": (
        '<polygon points="62,96 142,96 158,80 78,80" fill="#ffcf9a" stroke="#5a3a1a" '
        'stroke-width="3" stroke-linejoin="round"/>' + box_front() + ball(110, 62)
    ),
    # ball tucked beneath a raised slab
    "under": (
        '<rect x="46" y="86" width="108" height="20" rx="6" fill="#ffb26b" stroke="#5a3a1a" '
        'stroke-width="3"/>'
        '<rect x="54" y="106" width="14" height="60" fill="#e08b45" stroke="#5a3a1a" stroke-width="3"/>'
        '<rect x="132" y="106" width="14" height="60" fill="#e08b45" stroke="#5a3a1a" stroke-width="3"/>'
        + ball(100, 140)
    ),
    # ball flying across the top of the box
    "over": box() + ball(100, 44) + arrow("M40,74 Q100,14 160,74"),
    "next to": box(38, 100, 72, 50, 14) + ball(160, 140),
    # ball peeking out from behind the box: ball first, box painted over it
    "behind": ball(120, 84) + box(52, 100, 84, 54, 16),
    # ball painted last, overlapping the front of the box
    "in front of": box(52, 92, 84, 50, 16) + ball(104, 140),
    "between": (
        box(14, 100, 52, 50, 12) + box(126, 100, 52, 50, 12) + ball(100, 130)
    ),
    "up": (
        '<polygon points="34,166 34,140 78,140 78,114 122,114 122,88 166,88 166,166" '
        'fill="#ffcf9a" stroke="#5a3a1a" stroke-width="3" stroke-linejoin="round"/>'
        + ball(144, 65)
        + arrow("M52,120 L132,44")
    ),
    "down": (
        '<polygon points="34,166 34,88 78,88 78,114 122,114 122,140 166,140 166,166" '
        'fill="#ffcf9a" stroke="#5a3a1a" stroke-width="3" stroke-linejoin="round"/>'
        + ball(56, 65)
        + arrow("M68,44 L148,120")
    ),
    # a tunnel with the ball halfway out of the far end
    "through": (
        '<path d="M40,166 L40,116 A60,52 0 0 1 160,116 L160,166 Z" fill="#ffb26b" '
        'stroke="#5a3a1a" stroke-width="3" stroke-linejoin="round"/>'
        '<path d="M76,166 L76,122 A24,22 0 0 1 124,122 L124,166 Z" fill="#8a4a12" '
        'stroke="#5a3a1a" stroke-width="3" stroke-linejoin="round"/>'
        + ball(100, 140)
        + arrow("M22,140 L60,140")
        + arrow("M140,140 L178,140")
    ),
    "around": (
        box(72, 104, 56, 46, 12)
        + '<ellipse cx="100" cy="112" rx="76" ry="52" fill="none" stroke="#2f6bd8" '
        'stroke-width="6" stroke-dasharray="12 12" stroke-linecap="round"/>'
        + ball(176, 112, 16)
    ),
}

FILES = {
    "in": "prep-in.svg",
    "on": "prep-on.svg",
    "under": "prep-under.svg",
    "over": "prep-over.svg",
    "next to": "prep-next-to.svg",
    "behind": "prep-behind.svg",
    "in front of": "prep-in-front-of.svg",
    "between": "prep-between.svg",
    "up": "prep-up.svg",
    "down": "prep-down.svg",
    "through": "prep-through.svg",
    "around": "prep-around.svg",
}

for key, body in SCENES.items():
    path = os.path.join(OUT, FILES[key])
    with open(path, "w") as fh:
        fh.write(scene(body))
    print("wrote", FILES[key])
