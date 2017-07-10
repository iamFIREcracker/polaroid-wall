import React, { Component } from 'react';
import Gallery from './Gallery';
import './App.css';

const config = CONFIG; // eslint-disable-line no-undef


class App extends Component {
  constructor(props) {
    super(props);
    this.state = {
      theme: '',
      title: '',
      elements: []
    };
  }

  componentDidMount() {
    const elements = this.loadElements(config);
    document.title = config.title;
    this.setState({
      theme: window.location.hash.substring(1) || config.theme || 'White',
      title: config.title,
      elements,
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
          elements={this.state.elements}
        ></Gallery>
      </div>
    );
  }
}

export default App;
