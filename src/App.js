import React, { Component } from 'react';
import Gallery from './Gallery';
import VisibilitySensor from 'react-visibility-sensor';

import './App.css';

const config = CONFIG; // eslint-disable-line no-undef
const ITEMS_PER_LOAD = 7;


class App extends Component {
  constructor(props) {
    super(props);
    this.state = {
      theme: '',
      title: '',
      allElements: [],
      visibleElements: [],
      hasMore: false
    };
  }

  componentDidMount() {
    document.title = config.title;
    const elements = this.loadElements(config);
    this.setState({
      theme: window.location.hash.substring(1) || config.theme || 'White',
      title: config.title,
      allElements: elements,
      hasMore: elements.length > 0,
    });
  }

  loadElements(config) {
    return config.images.map(image => ({
      title: image.title,
      src: this.imageSrc(image.url || image.path),
      style: image.style || '',
    }));
  }

  imageSrc(urlOrPath) {
    let src;
    if (/https?:\/\//.test(urlOrPath)) { // url
      src = urlOrPath;
    } else if (/^\/\//.test(urlOrPath)) { // absolute path
      src = urlOrPath;
    } else { // relative path
      src = `${process.env.PUBLIC_URL}/${urlOrPath}`;
    }
    return src;
  }

  render() {
    return (
      <div className="App Wood">
        <div className="App-header">
          <h2>{this.state.title}</h2>
        </div>
        <Gallery
          theme={this.state.theme}
          elements={this.state.visibleElements}
        ></Gallery>
        { this.renderLoadMoreComponent() }
      </div>
    );
  }

  renderLoadMoreComponent() {
    if (this.state.hasMore) {
      return (
        <VisibilitySensor
          className="LoadMore"
          onChange={(visible) => this.onVisibilityChange(visible)}
        ></VisibilitySensor>
      );
    }
  }

  onVisibilityChange(visible) {
    if (visible) {
      const numVisibleItems = this.state.visibleElements.length + ITEMS_PER_LOAD;
      const visibleElements = this.state.allElements.slice(0, numVisibleItems);
      const hasMore = visibleElements.length !== this.state.allElements.length;
      this.setState({
        visibleElements,
        hasMore,
      });
    }
  }
}

export default App;
