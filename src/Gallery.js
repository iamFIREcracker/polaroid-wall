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


class Gallery extends Component {
  constructor(props) {
    super(props);
    // Polaroids are laid out before they know their final size: their images
    // only show up once scrolled into view, and their captions are written in
    // a web font which gets here whenever it gets here. Watch them, and lay
    // the wall out again whenever one of them settles.
    this.observer = canObserveResize
      ? new window.ResizeObserver(() => this.scheduleRelayout())
      : null;
  }

  componentWillUnmount() {
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
            <Textfit mode="single" className="Text">
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
