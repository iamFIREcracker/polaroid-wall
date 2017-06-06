import React, { Component } from 'react';
import Gallery from './Gallery';
import config from './images';
import './App.css';


class App extends Component {
  constructor(props) {
    super(props);
    this.state = {
      elements: []
    };
  }

  componentDidMount() {
    const elements = this.loadElements(config);
    this.setState({
      elements,
    });
  }

  loadElements(config) {
    const r = require.context('./images', false, /\.(png|jpe?g|svg)$/);
    return config.images.map(image => ({
      title: image.title,
      src: r(image.path),
    }));
  }

  render() {
    return (
      <div className="App">
        <div className="App-header">
          <h2>{config.title}</h2>
        </div>
        <Gallery elements={this.state.elements}></Gallery>
      </div>
    );
  }
}

export default App;
