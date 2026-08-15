import React, { Component } from 'react';
import Textfit from 'react-textfit';
import Masonry from 'react-masonry-component';
import LazyImage from './LazyImage';
import './Gallery.css';

const masonryOptions = {
  isFitWidth: true
};

// Polaroids settle one by one: coalesce the re-layouts they trigger.
const RELAYOUT_DELAY = 100;

const canObserveResize = typeof window !== 'undefined' && 'ResizeObserver' in window;

// The face the captions are written in, and which they have to be measured
// against. Matches the family in Gallery.css and the one index.html asks
// Google Fonts for.
const CAPTION_FONT = '1em "Permanent Marker"';


class Gallery extends Component {
  constructor(props) {
    super(props);
    this.state = { fontLoaded: false };
    // Polaroids are laid out before they know their final size: their images
    // only show up once scrolled into view, and their captions are written in
    // a web font which gets here whenever it gets here. Watch them, and lay
    // the wall out again whenever one of them settles.
    this.observer = canObserveResize
      ? new window.ResizeObserver(() => this.scheduleRelayout())
      : null;
  }

  componentDidMount() {
    // Textfit measures a caption once, on mount, and never again unless its
    // props change -- and by then Permanent Marker has usually not arrived
    // yet, so it fits the text against the fallback face and the web font then
    // swaps in wider, spilling the caption out of its polaroid. Wait for the
    // font and re-run the fit; render() remounts the Textfits by flipping
    // their key, which is the only public way to make them measure again.
    if (typeof document === 'undefined' || !document.fonts || !document.fonts.load) {
      return;
    }
    this.mounted = true;
    // A CDN that never answers resolves this with an empty list, and the
    // re-fit against the fallback face it triggers is a no-op.
    document.fonts.load(CAPTION_FONT).then(() => {
      if (this.mounted) {
        this.setState({ fontLoaded: true });
      }
    }, () => {});
  }

  componentWillUnmount() {
    this.mounted = false;
    if (this.observer) {
      this.observer.disconnect();
    }
    clearTimeout(this.relayoutTimeout);
  }

  observePolaroid(node) {
    if (this.observer && node) {
      this.observer.observe(node);
    }
  }

  render() {
    // Only the caption is keyed on the font: keying the frame -- or anything
    // wrapping LazyImage -- would remount the pictures and throw away the ones
    // already loaded.
    const captionKey = `caption-${this.state.fontLoaded}`;

    var childElements = this.props.elements.map((element, id) => {
      const classes = `PolaroidWrapper ${element.style}`;
      return (
        <div
          key={id}
          className={classes}
          ref={(node) => this.observePolaroid(node)}
        >
          <div className="Polaroid">
            <div className="ImageWrapper">
              <a
                href={element.src}
                data-lightbox={id}
                data-title={element.title}
              >
                <LazyImage src={element.src} />
              </a>
            </div>
            <Textfit key={captionKey} mode="single" className="Text">
              {element.title}
            </Textfit>
          </div>
        </div>
      );
    });

    const classes = `Gallery ${this.props.theme}`;
    return (
      <Masonry
        className={classes}
        options={masonryOptions}
        ref={(masonry) => { this.masonryComponent = masonry; }}
      >
        {childElements}
      </Masonry>
    );
  }

  scheduleRelayout() {
    if (this.relayoutTimeout) {
      return;
    }
    this.relayoutTimeout = setTimeout(() => {
      this.relayoutTimeout = null;
      if (this.masonryComponent && this.masonryComponent.masonry) {
        this.masonryComponent.masonry.layout();
      }
    }, RELAYOUT_DELAY);
  }
}

export default Gallery;
