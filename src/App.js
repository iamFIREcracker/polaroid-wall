import React, { Component } from 'react';
import Gallery from './Gallery';
import './App.css';

const config = CONFIG; // eslint-disable-line no-undef


class App extends Component {
  constructor(props) {
    super(props);
    this.state = {
      title: '',
      elements: []
    };
  }

  componentDidMount() {
    const elements = this.loadElements(config);
    this.setState({
      title: config.title,
      elements,
    });
  }

  loadElements(config) {
    return config.images.map(image => ({
      title: image.title,
      src: `${process.env.PUBLIC_URL}/images/${image.path}`,
    }));
  }

  render() {
    return (
      <div className="App">
        <div className="App-header">
          <h2>{this.state.title}</h2>
        </div>
        <Gallery elements={this.state.elements}></Gallery>
      </div>
    );
  }
}

export default App;
