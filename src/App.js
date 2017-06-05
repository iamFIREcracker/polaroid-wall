import React, { Component } from 'react';
import Gallery from './Gallery'
import logo from './logo.svg';
import './App.css';


function importAll(r) {
  return r.keys().map(r);
}

class App extends Component {
  constructor(props) {
    super(props);
    this.state = {
      elements: []
    };
  }

  componentDidMount() {
    const images = importAll(require.context('./images', false, /\.(png|jpe?g|svg)$/));
    this.setState({
      elements: images.map(path => ({ src: path }))
    });
  }

  render() {
    return (
      <div className="App">
        <div className="App-header">
          <h2>Just married! xoxo</h2>
        </div>
        <Gallery elements={this.state.elements}></Gallery>
      </div>
    );
  }
}

export default App;
