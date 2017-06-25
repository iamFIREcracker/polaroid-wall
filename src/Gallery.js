import React, { Component } from 'react';
import Textfit from 'react-textfit';
import Masonry from 'react-masonry-component';
import './Gallery.css';

const masonryOptions = {
  isFitWidth: true
};


class Gallery extends Component {
  render() {
    var childElements = this.props.elements.map(function(element, id){
      const classes = `PolaroidWrapper ${element.style}`;
      return (
        <div key={id} className={classes}>
          <div className="Polaroid">
            <div className="ImageWrapper">
              <img alt="" src={element.src} />
            </div>
            <Textfit mode="single" className="Text">
              {element.title}
            </Textfit>
          </div>
        </div>
      );
    });

    return (
      <Masonry
        className={'Gallery'} // default ''
        disableImagesLoaded={false} // default false
        updateOnEachImageLoad={false} // default false and works only if disableImagesLoaded is false
        options={masonryOptions}
      >
        {childElements}
      </Masonry>
    );
  }
}

export default Gallery;
