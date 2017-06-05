import React, { Component } from 'react';
import Masonry from 'react-masonry-component';
import './Gallery.css';


const masonryOptions = {
    transitionDuration: 0
};

class Gallery extends Component {
  render() {
    var childElements = this.props.elements.map(function(element, id){
      return (
        <div key={id} className="PolaroidWrapper">
          <div className="Polaroid">
            <div className="ImageWrapper">
              <img alt="" src={element.src} />
            </div>
            <span className="Text">
              Some text matteo landi nato a viareggi
            </span>
          </div>
        </div>
      );
    });

    return (
      <Masonry
        className={'Gallery'} // default ''
        options={masonryOptions} // default {}
        disableImagesLoaded={false} // default false
        updateOnEachImageLoad={false} // default false and works only if disableImagesLoaded is false
      >
        {childElements}
      </Masonry>
    );
  }
}

export default Gallery;
