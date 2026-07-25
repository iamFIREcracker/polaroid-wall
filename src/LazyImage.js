import React, { Component } from 'react';

// Start loading images a bit before they enter the viewport, so that scrolling
// at a normal pace never reveals an empty frame.
const ROOT_MARGIN = '400px';

const canObserveVisibility = typeof window !== 'undefined' && 'IntersectionObserver' in window;


class LazyImage extends Component {
  constructor(props) {
    super(props);
    // Without IntersectionObserver there is no way of telling when the frame
    // scrolls into view: fall back to loading the image right away.
    this.state = {
      show: !canObserveVisibility,
      loaded: false,
    };
  }

  componentDidMount() {
    if (this.state.show) {
      return;
    }
    this.observer = new window.IntersectionObserver(
      (entries) => this.onIntersection(entries),
      { rootMargin: ROOT_MARGIN }
    );
    this.observer.observe(this.frame);
  }

  componentWillUnmount() {
    this.stopObserving();
  }

  onIntersection(entries) {
    if (entries.some(entry => entry.isIntersecting)) {
      // Once in view, the image is here to stay: no need to keep watching.
      this.stopObserving();
      this.setState({ show: true });
    }
  }

  stopObserving() {
    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }
  }

  // Broken images are treated like loaded ones: better an empty frame than one
  // holding on to the (bigger) placeholder forever.
  onLoad() {
    this.setState({ loaded: true });
  }

  render() {
    const classes = `LazyImage ${this.state.loaded ? 'Loaded' : 'Loading'}`;
    return (
      <div
        className={classes}
        ref={(frame) => { this.frame = frame; }}
      >
        { this.state.show &&
          <img
            alt=""
            src={this.props.src}
            onLoad={() => this.onLoad()}
            onError={() => this.onLoad()}
          /> }
      </div>
    );
  }
}

export default LazyImage;
